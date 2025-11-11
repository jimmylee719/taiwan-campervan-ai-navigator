const WMO_CODE_MAP: { [key: number]: { description: string; icon: string } } = {
    0: { description: 'Clear sky', icon: '☀️' },
    1: { description: 'Mainly clear', icon: '🌤️' },
    2: { description: 'Partly cloudy', icon: '⛅️' },
    3: { description: 'Overcast', icon: '☁️' },
    45: { description: 'Fog', icon: '🌫️' },
    48: { description: 'Depositing rime fog', icon: '🌫️' },
    51: { description: 'Light drizzle', icon: '🌦️' },
    53: { description: 'Moderate drizzle', icon: '🌦️' },
    55: { description: 'Dense drizzle', icon: '🌦️' },
    56: { description: 'Light freezing drizzle', icon: '🌨️' },
    57: { description: 'Dense freezing drizzle', icon: '🌨️' },
    61: { description: 'Slight rain', icon: '🌧️' },
    63: { description: 'Moderate rain', icon: '🌧️' },
    65: { description: 'Heavy rain', icon: '🌧️' },
    66: { description: 'Light freezing rain', icon: '🌨️' },
    67: { description: 'Heavy freezing rain', icon: '🌨️' },
    71: { description: 'Slight snow fall', icon: '❄️' },
    73: { description: 'Moderate snow fall', icon: '❄️' },
    75: { description: 'Heavy snow fall', icon: '❄️' },
    77: { description: 'Snow grains', icon: '❄️' },
    80: { description: 'Slight rain showers', icon: '🌦️' },
    81: { description: 'Moderate rain showers', icon: '🌦️' },
    82: { description: 'Violent rain showers', icon: '⛈️' },
    85: { description: 'Slight snow showers', icon: '🌨️' },
    86: { description: 'Heavy snow showers', icon: '🌨️' },
    95: { description: 'Thunderstorm', icon: '⛈️' },
    96: { description: 'Thunderstorm with slight hail', icon: '⛈️' },
    99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

export const getWeatherForecast = async (lat: number, lng: number, date: string): Promise<string | null> => {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${date}&end_date=${date}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Failed to fetch weather data");
            return null;
        }
        const data = await response.json();
        
        if (data && data.daily && data.daily.weathercode) {
            const weatherCode = data.daily.weathercode[0];
            const maxTemp = Math.round(data.daily.temperature_2m_max[0]);
            const minTemp = Math.round(data.daily.temperature_2m_min[0]);
            const weatherInfo = WMO_CODE_MAP[weatherCode] || { description: 'Weather', icon: '🌡️' };

            return `${weatherInfo.icon} ${weatherInfo.description}, ${minTemp}°C to ${maxTemp}°C`;
        }
        return null;

    } catch (error) {
        console.error("Error in getWeatherForecast:", error);
        return null;
    }
};