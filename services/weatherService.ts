import { WeatherData, ProcessedData } from '../types';

export const fetchRainfallData = async (lat: number, lon: number): Promise<ProcessedData[]> => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 14); // Last 14 days

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&daily=rain_sum&timezone=auto`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch data');
    const json = await response.json();
    
    if (!json.daily) return [];

    const { time, rain_sum } = json.daily as WeatherData;

    return time.map((t, i) => ({
      date: t,
      value: rain_sum[i] || 0,
      label: new Date(t).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
    }));
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return [];
  }
};
