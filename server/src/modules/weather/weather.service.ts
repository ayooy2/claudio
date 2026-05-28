import { config } from '../../config.js';

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
    if (config.mock.weather) {
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
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${config.openWeather.city}&appid=${config.openWeather.apiKey}&units=metric&lang=zh_cn`
      );
      const data = await res.json() as any;
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
    } catch {
      return { mock: true, city: config.openWeather.city, temp: 22, feels_like: 20, description: '未知', icon: '01d', humidity: 45, wind_speed: 0, is_day: true };
    }
  }

  toString(w: WeatherData): string {
    const tag = w.mock ? '[Mock] ' : '';
    return `${tag}${w.city} ${w.description}，${w.temp}°C，湿度${w.humidity}%`;
  }
}

export const weatherService = new WeatherService();
