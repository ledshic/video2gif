use serde::{Deserialize, Serialize};

/// Chat-app-friendly default (WeChat / Telegram / Discord style).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatPreset {
    pub name: &'static str,
    pub label_zh: &'static str,
    pub width: u32,
    pub fps: u32,
    pub max_duration: f64,
    pub colors: u32,
    pub dither: &'static str,
    pub loop_count: i32,
    pub speed: f64,
}

pub const WECHAT_LIKE: ChatPreset = ChatPreset {
    name: "wechat",
    label_zh: "微信友好",
    width: 480,
    fps: 12,
    max_duration: 15.0,
    colors: 256,
    dither: "sierra2_4a",
    loop_count: 0,
    speed: 1.0,
};

pub const TELEGRAM_LIKE: ChatPreset = ChatPreset {
    name: "telegram",
    label_zh: "Telegram 友好",
    width: 480,
    fps: 12,
    max_duration: 15.0,
    colors: 256,
    dither: "sierra2_4a",
    loop_count: 0,
    speed: 1.0,
};

pub const DISCORD_LIKE: ChatPreset = ChatPreset {
    name: "discord",
    label_zh: "Discord 友好",
    width: 480,
    fps: 15,
    max_duration: 10.0,
    colors: 256,
    dither: "sierra2_4a",
    loop_count: 0,
    speed: 1.0,
};

/// Default simple-mode preset used by Video2GIF UI.
pub const SIMPLE_DEFAULT: ChatPreset = WECHAT_LIKE;

pub fn all_presets() -> Vec<&'static ChatPreset> {
    vec![&WECHAT_LIKE, &TELEGRAM_LIKE, &DISCORD_LIKE]
}
