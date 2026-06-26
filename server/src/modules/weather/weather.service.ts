import { config } from '../../config.js';
import { logger } from '../../common/logger.js';

const log = logger.child('weather');

export interface WeatherData {
  mock: boolean;
  city: string;
  temp: number;
  feels_like: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
  is_day: boolean;
}

export class WeatherService {
  async getCurrent(): Promise<WeatherData> {
    if (config.mock.weather || !config.openWeather.apiKey) {
      log.info('使用 mock 天气数据');
      return {
        mock: true,
        city: config.openWeather.city,
        temp: 22,
        feels_like: 20,
        description: '晴',
        icon: '01d',
        humidity: 45,
        wind_speed: 3.2,
        is_day: true,
      };
    }

    try {
      log.info(`正在获取 ${config.openWeather.city} 天气数据`);
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${config.openWeather.city}&appid=${config.openWeather.apiKey}&units=metric&lang=zh_cn`
      );
      const data = await res.json() as any;
      log.info(`天气获取成功: ${data.name} ${Math.round(data.main.temp)}°C`);
      return {
        mock: false,
        city: data.name,
        temp: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        description: data.weather?.[0]?.description ?? '',
        icon: data.weather?.[0]?.icon ?? '',
        humidity: data.main.humidity,
        wind_speed: data.wind?.speed ?? 0,
        is_day: data.weather?.[0]?.icon?.includes('d') ?? true,
      };
    } catch (err) {
      log.warn('天气获取失败，回退到 mock 数据', err);
      return { mock: true, city: config.openWeather.city, temp: 22, feels_like: 20, description: '未知', icon: '01d', humidity: 45, wind_speed: 0, is_day: true };
    }
  }

  toString(w: WeatherData): string {
    const tag = w.mock ? '[Mock] ' : '';
    return `${tag}${w.city} ${w.description}，${w.temp}°C，湿度${w.humidity}%`;
  }
}

export const weatherService = new WeatherService();
