// Зачем: рынок в этом проекте выдуманный, но шаг цены и случайность должны жить внутри Wasm, а не в пустой обёртке на TypeScript.
// Что делает: хранит цену каждого инструмента между вызовами и за один вызов пишет ровно запрошенное число событий в линейную память.

use wasm_bindgen::prelude::*;

/// Seven i32 fields per event. The TypeScript adapter reads the same order.
const EVENT_STRIDE: usize = 7;
const INITIAL_PRICE_CENTS: i32 = 10_000;
const MAX_PRICE_STEP_CENTS: i32 = 15;
const MAX_SPREAD_CENTS: i32 = 40;
const MAX_TRADE_QUANTITY: i32 = 100;
const MAX_BOOK_QUANTITY: i32 = 1_000;

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

fn step_price(previous: i32, step: i32) -> i32 {
    let next = previous.saturating_add(step);
    if next < 1 {
        1
    } else {
        next
    }
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
        let instrument_index = self.rng.gen_inclusive(0, self.states.len() as i32 - 1);
        let step = self
            .rng
            .gen_inclusive(-MAX_PRICE_STEP_CENTS, MAX_PRICE_STEP_CENTS);
        let spread = self.rng.gen_inclusive(1, MAX_SPREAD_CENTS);
        // Цена сделки этого события — его bid или ask, не середина.
        let trade_on_ask = self.rng.gen_inclusive(0, 1) == 1;
        let trade_quantity = self.rng.gen_inclusive(1, MAX_TRADE_QUANTITY);
        let bid_quantity = self.rng.gen_inclusive(0, MAX_BOOK_QUANTITY);
        let ask_quantity = self.rng.gen_inclusive(0, MAX_BOOK_QUANTITY);

        let state = &mut self.states[instrument_index as usize];
        let bid_cents = step_price(state.price_cents, step);
        state.price_cents = bid_cents;
        let ask_cents = bid_cents + spread;
        let price_cents = if trade_on_ask { ask_cents } else { bid_cents };

        GeneratedEvent {
            instrument_index,
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
            assert!(event.ask_cents - event.bid_cents <= MAX_SPREAD_CENTS);
            assert!(event.price_cents == event.bid_cents || event.price_cents == event.ask_cents);
            assert!(event.trade_quantity > 0);
            assert!(event.trade_quantity <= MAX_TRADE_QUANTITY);
            assert!(event.bid_quantity >= 0);
            assert!(event.ask_quantity >= 0);
            assert!(event.bid_quantity <= MAX_BOOK_QUANTITY);
            assert!(event.ask_quantity <= MAX_BOOK_QUANTITY);
        }
    }

    #[test]
    fn next_price_moves_from_the_previous_one_by_at_most_the_step() {
        let mut generator = generator(3, &["ALFA", "BETA", "GAMA"]);
        let mut previous = vec![INITIAL_PRICE_CENTS; 3];
        for event in generator.next_batch(300) {
            let index = event.instrument_index as usize;
            let delta = (event.bid_cents - previous[index]).abs();
            assert!(delta <= MAX_PRICE_STEP_CENTS);
            previous[index] = event.bid_cents;
        }
    }

    #[test]
    fn price_does_not_fall_to_zero() {
        assert_eq!(step_price(1, -MAX_PRICE_STEP_CENTS), 1);
        assert_eq!(step_price(10, -MAX_PRICE_STEP_CENTS), 1);
        assert_eq!(
            step_price(INITIAL_PRICE_CENTS, MAX_PRICE_STEP_CENTS),
            10_015
        );
        assert_eq!(
            step_price(INITIAL_PRICE_CENTS, -MAX_PRICE_STEP_CENTS),
            9_985
        );
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
