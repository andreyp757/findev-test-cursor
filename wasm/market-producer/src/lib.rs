// Зачем: рынок в этом проекте выдуманный, но шаг цены и случайность должны жить внутри Wasm, а не в пустой обёртке на TypeScript.
// Что делает: хранит цену каждого инструмента между вызовами и за один вызов пишет ровно запрошенное число событий в линейную память.

use wasm_bindgen::prelude::*;

/// Seven i32 fields per event. The TypeScript adapter reads the same order.
const EVENT_STRIDE: usize = 7;
const INITIAL_PRICE_CENTS: i32 = 10_000;
const ANCHOR_CENTS: i32 = 10_000;
/// Random step is at most this many basis points of the current price.
const MAX_NOISE_BP: i32 = 15;
/// Each step also moves 0.25% of the distance back toward the anchor.
const REVERSION_DENOMINATOR: i64 = 400;
const MAX_SPREAD_BP: i32 = 40;
const MAX_TRADE_QUANTITY: i32 = 100;
const BOOK_ANCHOR: i32 = 400;
const MAX_BOOK: i32 = 2_000;
const MAX_BOOK_STEP: i32 = 25;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GeneratedEvent {
    pub instrument_index: i32,
    pub price_cents: i32,
    pub trade_quantity: i32,
    pub bid_cents: i32,
    pub ask_cents: i32,
    pub bid_quantity: i32,
    pub ask_quantity: i32,
}

#[derive(Clone)]
struct InstrumentState {
    price_cents: i32,
    bid_quantity: i32,
    ask_quantity: i32,
}

struct XorShift32 {
    state: u32,
}

impl XorShift32 {
    fn new(seed: u32) -> Self {
        Self {
            state: if seed == 0 { 1 } else { seed },
        }
    }

    fn next_u32(&mut self) -> u32 {
        let mut value = self.state;
        value ^= value << 13;
        value ^= value >> 17;
        value ^= value << 5;
        self.state = value;
        value
    }

    fn gen_inclusive(&mut self, min: i32, max: i32) -> i32 {
        let span = (max - min + 1) as u32;
        min + (self.next_u32() % span) as i32
    }
}

fn price_delta_cents(price: i32, signed_bp: i32) -> i32 {
    if signed_bp == 0 {
        return 0;
    }
    let raw = i64::from(price.max(1)) * i64::from(signed_bp) / 10_000;
    if raw == 0 {
        if signed_bp > 0 {
            1
        } else {
            -1
        }
    } else {
        raw as i32
    }
}

fn reversion_cents(price: i32) -> i32 {
    let gap = i64::from(ANCHOR_CENTS) - i64::from(price);
    (gap / REVERSION_DENOMINATOR) as i32
}

fn next_price(previous: i32, noise_bp: i32) -> i32 {
    let next = i64::from(previous)
        + i64::from(reversion_cents(previous))
        + i64::from(price_delta_cents(previous, noise_bp));
    next.clamp(1, i64::from(i32::MAX)) as i32
}

#[cfg(test)]
fn max_abs_move(price: i32) -> i32 {
    let noise = price_delta_cents(price.max(1), MAX_NOISE_BP).abs();
    let pull = reversion_cents(price).abs();
    noise.saturating_add(pull)
}

fn spread_cents(bid: i32, spread_bp: i32) -> i32 {
    let raw = i64::from(bid.max(1)) * i64::from(spread_bp.max(1)) / 10_000;
    i32::try_from(raw.max(1)).unwrap_or(i32::MAX)
}

fn quote(bid: i32, spread: i32) -> (i32, i32) {
    let spread = spread.max(1);
    if let Some(ask) = bid.checked_add(spread) {
        if ask > bid {
            return (bid, ask);
        }
    }
    let safe_bid = (i32::MAX - spread).max(1);
    (safe_bid, safe_bid.saturating_add(spread))
}

fn next_quantity(previous: i32, noise: i32) -> i32 {
    let pull = (i64::from(BOOK_ANCHOR) - i64::from(previous)) / 20;
    let next = i64::from(previous) + pull + i64::from(noise);
    next.clamp(0, i64::from(MAX_BOOK)) as i32
}

#[wasm_bindgen]
pub struct MarketGenerator {
    states: Vec<InstrumentState>,
    rng: XorShift32,
    buffer: Vec<i32>,
}

impl MarketGenerator {
    pub fn create(seed: u32, names: Vec<String>) -> Result<MarketGenerator, &'static str> {
        if names.is_empty() {
            return Err("Генератору нужен хотя бы один инструмент.");
        }
        let states = vec![
            InstrumentState {
                price_cents: INITIAL_PRICE_CENTS,
                bid_quantity: BOOK_ANCHOR,
                ask_quantity: BOOK_ANCHOR,
            };
            names.len()
        ];
        Ok(MarketGenerator {
            states,
            rng: XorShift32::new(seed),
            buffer: Vec::new(),
        })
    }

    pub fn next_batch(&mut self, count: usize) -> Vec<GeneratedEvent> {
        let mut events = Vec::with_capacity(count);
        for _ in 0..count {
            events.push(self.next_event());
        }
        events
    }

    fn next_event(&mut self) -> GeneratedEvent {
        let instrument_index = self.rng.gen_inclusive(0, self.states.len() as i32 - 1) as usize;
        let noise_bp = self.rng.gen_inclusive(-MAX_NOISE_BP, MAX_NOISE_BP);
        let spread_bp = self.rng.gen_inclusive(1, MAX_SPREAD_BP);
        // Цена сделки этого события — его bid или ask, не середина.
        let trade_on_ask = self.rng.gen_inclusive(0, 1) == 1;
        let trade_quantity = self.rng.gen_inclusive(1, MAX_TRADE_QUANTITY);
        let bid_noise = self.rng.gen_inclusive(-MAX_BOOK_STEP, MAX_BOOK_STEP);
        let ask_noise = self.rng.gen_inclusive(-MAX_BOOK_STEP, MAX_BOOK_STEP);

        let state = &mut self.states[instrument_index];
        let stepped = next_price(state.price_cents, noise_bp);
        let (bid_cents, ask_cents) = quote(stepped, spread_cents(stepped, spread_bp));
        state.price_cents = bid_cents;
        state.bid_quantity = next_quantity(state.bid_quantity, bid_noise);
        state.ask_quantity = next_quantity(state.ask_quantity, ask_noise);
        let price_cents = if trade_on_ask { ask_cents } else { bid_cents };
        let bid_quantity = state.bid_quantity;
        let ask_quantity = state.ask_quantity;

        GeneratedEvent {
            instrument_index: instrument_index as i32,
            price_cents,
            trade_quantity,
            bid_cents,
            ask_cents,
            bid_quantity,
            ask_quantity,
        }
    }
}

#[wasm_bindgen]
impl MarketGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32, names: Vec<String>) -> Result<MarketGenerator, JsValue> {
        MarketGenerator::create(seed, names).map_err(JsValue::from_str)
    }

    /// Writes `count` events at the returned pointer. The pointer is valid until the next call.
    #[wasm_bindgen(js_name = fillBatch)]
    pub fn fill_batch(&mut self, count: u32) -> u32 {
        let events = self.next_batch(count as usize);
        self.buffer.clear();
        self.buffer.reserve(events.len() * EVENT_STRIDE);
        for event in events {
            self.buffer.extend_from_slice(&[
                event.instrument_index,
                event.price_cents,
                event.trade_quantity,
                event.bid_cents,
                event.ask_cents,
                event.bid_quantity,
                event.ask_quantity,
            ]);
        }
        self.buffer.as_ptr() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn generator(seed: u32, names: &[&str]) -> MarketGenerator {
        let owned = names.iter().map(|name| (*name).to_string()).collect();
        MarketGenerator::create(seed, owned).expect("names")
    }

    #[test]
    fn batch_length_matches_the_request() {
        let mut generator = generator(1, &["ALFA", "BETA", "GAMA", "DLTA"]);
        assert_eq!(generator.next_batch(0).len(), 0);
        assert_eq!(generator.next_batch(1).len(), 1);
        assert_eq!(generator.next_batch(100).len(), 100);
        assert_eq!(generator.next_batch(1000).len(), 1000);
    }

    #[test]
    fn events_stay_inside_the_market_rules() {
        let mut generator = generator(7, &["ALFA", "BETA", "GAMA", "DLTA", "EPSI"]);
        for event in generator.next_batch(500) {
            assert!((0..5).contains(&event.instrument_index));
            assert!(event.bid_cents > 0);
            assert!(event.ask_cents > 0);
            assert!(event.price_cents > 0);
            assert!(event.bid_cents < event.ask_cents);
            let spread_cap = spread_cents(event.bid_cents, MAX_SPREAD_BP);
            assert!(event.ask_cents - event.bid_cents <= spread_cap);
            assert!(event.price_cents == event.bid_cents || event.price_cents == event.ask_cents);
            assert!(event.trade_quantity > 0);
            assert!(event.trade_quantity <= MAX_TRADE_QUANTITY);
            assert!(event.bid_quantity >= 0);
            assert!(event.ask_quantity >= 0);
            assert!(event.bid_quantity <= MAX_BOOK);
            assert!(event.ask_quantity <= MAX_BOOK);
        }
    }

    #[test]
    fn next_price_moves_from_the_previous_one_by_at_most_the_step() {
        let mut generator = generator(3, &["ALFA", "BETA", "GAMA"]);
        let mut previous = vec![INITIAL_PRICE_CENTS; 3];
        for event in generator.next_batch(300) {
            let index = event.instrument_index as usize;
            let delta = (event.bid_cents - previous[index]).abs();
            assert!(delta <= max_abs_move(previous[index]));
            previous[index] = event.bid_cents;
        }
    }

    #[test]
    fn price_stays_positive_and_near_the_anchor_on_a_long_run() {
        assert!(next_price(1, -MAX_NOISE_BP) > 1);
        assert_eq!(next_price(INITIAL_PRICE_CENTS, MAX_NOISE_BP), 10_015);
        assert_eq!(next_price(INITIAL_PRICE_CENTS, -MAX_NOISE_BP), 9_985);

        let mut generator = generator(7, &["ALFA"]);
        let mut lowest = i32::MAX;
        let mut highest = 0;
        for _ in 0..2_000 {
            for event in generator.next_batch(1_000) {
                lowest = lowest.min(event.bid_cents);
                highest = highest.max(event.bid_cents);
            }
        }
        assert!(lowest > 5_000, "price pinned too low: {lowest}");
        assert!(highest < 20_000, "price ran away: {highest}");
    }

    #[test]
    fn book_quantities_keep_memory_between_steps() {
        assert_eq!(next_quantity(BOOK_ANCHOR, 0), BOOK_ANCHOR);
        let stepped = next_quantity(BOOK_ANCHOR, MAX_BOOK_STEP);
        assert!((stepped - BOOK_ANCHOR).abs() <= MAX_BOOK_STEP);
        assert_eq!(next_quantity(0, -MAX_BOOK_STEP), 0);
    }

    #[test]
    fn the_same_seed_repeats_and_state_survives_between_calls() {
        let mut left = generator(42, &["ALFA", "BETA"]);
        let mut right = generator(42, &["ALFA", "BETA"]);
        let mut combined = left.next_batch(10);
        combined.extend(left.next_batch(10));
        assert_eq!(combined, right.next_batch(20));
    }

    #[test]
    fn a_different_seed_changes_the_batch() {
        let mut first = generator(1, &["ALFA", "BETA"]);
        let mut second = generator(2, &["ALFA", "BETA"]);
        assert_ne!(first.next_batch(20), second.next_batch(20));
    }

    #[test]
    fn names_from_the_caller_limit_the_instrument_index() {
        let mut single = generator(9, &["ALFA"]);
        assert!(single
            .next_batch(50)
            .iter()
            .all(|event| event.instrument_index == 0));

        let mut three = generator(9, &["ALFA", "BETA", "GAMA"]);
        let events = three.next_batch(90);
        let mut seen = [false; 3];
        for event in events {
            assert!((0..3).contains(&event.instrument_index));
            seen[event.instrument_index as usize] = true;
        }
        assert_eq!(seen, [true, true, true]);
    }

    #[test]
    fn an_empty_name_list_is_rejected() {
        match MarketGenerator::create(1, Vec::new()) {
            Err(error) => assert_eq!(error, "Генератору нужен хотя бы один инструмент."),
            Ok(_) => panic!("empty name list must be rejected"),
        }
    }

    #[test]
    fn fill_batch_lays_events_out_as_flat_i32_fields() {
        let mut source = generator(4, &["ALFA", "BETA"]);
        let mut encoded = generator(4, &["ALFA", "BETA"]);
        let events = source.next_batch(5);
        encoded.fill_batch(5);
        assert_eq!(encoded.buffer.len(), 5 * EVENT_STRIDE);
        for (index, event) in events.iter().enumerate() {
            let offset = index * EVENT_STRIDE;
            assert_eq!(encoded.buffer[offset], event.instrument_index);
            assert_eq!(encoded.buffer[offset + 1], event.price_cents);
            assert_eq!(encoded.buffer[offset + 2], event.trade_quantity);
            assert_eq!(encoded.buffer[offset + 3], event.bid_cents);
            assert_eq!(encoded.buffer[offset + 4], event.ask_cents);
            assert_eq!(encoded.buffer[offset + 5], event.bid_quantity);
            assert_eq!(encoded.buffer[offset + 6], event.ask_quantity);
        }
    }
}
