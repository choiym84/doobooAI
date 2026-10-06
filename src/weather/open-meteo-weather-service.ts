export type CurrentWeather = {
  locationName: string;
  requestedLocation: string;
  timezone: string;
  temperatureC: number;
  apparentTemperatureC: number;
  precipitationMm: number;
  windSpeedKmh: number;
  weatherCode: number;
  date: string;
  minTemperatureC: number;
  maxTemperatureC: number;
  precipitationProbabilityMax: number;
  precipitationSumMm: number;
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
  }>;
};

type ForecastResponse = {
  timezone: string;
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    precipitation: number;
    wind_speed_10m: number;
    weather_code: number;
  };
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
};

const locationAliases: Record<string, { query: string; display: string }> = {
  서울: { query: "Seoul", display: "서울" },
  서울특별시: { query: "Seoul", display: "서울" },
  부산: { query: "Busan", display: "부산" },
  부산광역시: { query: "Busan", display: "부산" },
  인천: { query: "Incheon", display: "인천" },
  인천광역시: { query: "Incheon", display: "인천" },
  대구: { query: "Daegu", display: "대구" },
  대전: { query: "Daejeon", display: "대전" },
  광주: { query: "Gwangju", display: "광주" },
  울산: { query: "Ulsan", display: "울산" },
  세종: { query: "Sejong", display: "세종" },
  제주: { query: "Jeju City", display: "제주" },
};

function resolveLocation(location: string): { query: string; display: string } {
  const normalized = location.replace(/\s+/g, "").trim();
  return locationAliases[normalized] ?? { query: location, display: location };
}

export class OpenMeteoWeatherService {
  async getCurrentWeather(location: string): Promise<CurrentWeather | null> {
    const resolvedLocation = resolveLocation(location);
    const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodingUrl.searchParams.set("name", resolvedLocation.query);
    geocodingUrl.searchParams.set("count", "1");
    geocodingUrl.searchParams.set("language", "ko");
    geocodingUrl.searchParams.set("format", "json");

    const geocodingResponse = await fetch(geocodingUrl, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!geocodingResponse.ok) {
      throw new Error(`Weather geocoding failed: ${geocodingResponse.status}`);
    }

    const geocoding = await geocodingResponse.json() as GeocodingResponse;
    const place = geocoding.results?.[0];
    if (!place) {
      return null;
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(place.latitude));
    forecastUrl.searchParams.set("longitude", String(place.longitude));
    forecastUrl.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code",
    );
    forecastUrl.searchParams.set(
      "daily",
      "weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum",
    );
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("forecast_days", "1");

    const forecastResponse = await fetch(forecastUrl, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!forecastResponse.ok) {
      throw new Error(`Weather forecast failed: ${forecastResponse.status}`);
    }

    const forecast = await forecastResponse.json() as ForecastResponse;
    return {
      locationName: place.name,
      requestedLocation: resolvedLocation.display,
      timezone: forecast.timezone,
      temperatureC: forecast.current.temperature_2m,
      apparentTemperatureC: forecast.current.apparent_temperature,
      precipitationMm: forecast.current.precipitation,
      windSpeedKmh: forecast.current.wind_speed_10m,
      weatherCode: forecast.current.weather_code,
      date: forecast.daily.time[0],
      minTemperatureC: forecast.daily.temperature_2m_min[0],
      maxTemperatureC: forecast.daily.temperature_2m_max[0],
      precipitationProbabilityMax: forecast.daily.precipitation_probability_max[0],
      precipitationSumMm: forecast.daily.precipitation_sum[0],
    };
  }
}

export function describeWeatherCode(code: number): string {
  if (code === 0) return "맑음";
  if ([1, 2, 3].includes(code)) return "구름 조금 또는 흐림";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "뇌우";
  return "날씨 정보 확인 필요";
}
