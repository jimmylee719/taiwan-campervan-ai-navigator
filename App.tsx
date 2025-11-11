import React, { useState, useCallback } from 'react';
import { SidePanel } from './components/SidePanel';
import { MapComponent } from './components/MapComponent';
import { Modal } from './components/Modal';
import { Message, Position, Poi, Waypoint } from './types';
import { generateItinerary } from './services/geminiService';
import { getWeatherForecast } from './services/weatherService';

const initialMessage: Message = {
  role: 'assistant',
  content: 'Welcome! Please describe your dream campervan trip in Taiwan. **Crucially, include the start and end dates** so I can provide weather forecasts. For example: "Plan a 7-day trip from Taipei to Kaohsiung, starting July 22nd, 2024, focusing on coastal views and seafood."',
};

// Helper function to parse potentially malformed JSON from the AI
const parseAndCleanJson = <T,>(jsonString: string): T | null => {
  try {
    // First, try to parse the string as-is
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("Initial JSON.parse failed. Attempting to clean and re-parse.", e);
    try {
      // Attempt to fix common errors:
      // 1. Unquoted property names.
      // 2. Trailing commas in objects or arrays.
      const cleanedString = jsonString
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":') // Add quotes to keys
        .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas

      return JSON.parse(cleanedString);
    } catch (e2) {
      console.error("Failed to parse JSON even after cleaning.", e2);
      // As a last resort, the AI might have added extra text after the JSON.
      // Let's try to extract just the main array.
      const match = jsonString.match(/(\[.*\])/s);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1]);
        } catch (e3) {
          console.error("Final attempt to parse extracted array failed.", e3);
        }
      }
      return null;
    }
  }
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);
  const [modalContent, setModalContent] = useState<'about' | 'privacy' | 'safety' | null>(null);

  const parseWaypointsFromResponse = (text: string): Waypoint[] => {
    const match = text.match(/WAYPOINTS:\s*(\[.*?\])/s);
    if (match && match[1]) {
      const parsed = parseAndCleanJson<Waypoint[]>(match[1]);
      if (parsed && Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && item !== null && 'name' in item && 'lat' in item && 'lng' in item)) {
        return parsed;
      } else {
        console.error("Failed to parse or validate WAYPOINTS:", parsed);
        setError("Failed to parse waypoints from AI response or data was invalid.");
      }
    }
    return [];
  };

  const parsePoisFromResponse = (text: string): Poi[] => {
    const match = text.match(/POIS:\s*(\[.*?\])/s);
    if (match && match[1]) {
        const parsed = parseAndCleanJson<Poi[]>(match[1]);
        if (parsed && Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && item !== null && 'name' in item && 'address' in item && 'lat' in item && 'lng' in item)) {
            return parsed;
        } else {
            console.error("Failed to parse or validate POIs:", parsed);
            setError("Failed to parse points of interest from AI response or data was invalid.");
        }
    }
    return [];
  };

  const parseStartDateFromResponse = (text: string): string | null => {
    const match = text.match(/START_DATE:\s*(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  const addWeatherToItinerary = async (itineraryText: string, waypoints: Waypoint[], startDateStr: string) => {
    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
        console.error("Invalid start date provided by AI");
        return itineraryText; // Return original text if date is invalid
    }
    
    // Create a copy to avoid timezone issues with date manipulation
    let currentDate = new Date(startDate.getTime());
    
    const dayRegex = /(## Day \d+:.*)/g;
    const dayHeadings = [...itineraryText.matchAll(dayRegex)];

    let updatedItinerary = itineraryText;

    for (let i = 0; i < dayHeadings.length; i++) {
        const heading = dayHeadings[i][1];
        // Use the destination of that day's drive for the weather forecast
        const location = waypoints[i + 1] || waypoints[waypoints.length - 1];
        
        if (location) {
            const dateForApi = currentDate.toISOString().split('T')[0];
            const weatherInfo = await getWeatherForecast(location.lat, location.lng, dateForApi);
            
            // Show a fallback if weather data is unavailable for the date.
            const weatherDisplay = weatherInfo || '❓ Forecast unavailable';
            const weatherHtml = `\n\n**Weather Forecast:** ${weatherDisplay}`;
            updatedItinerary = updatedItinerary.replace(heading, `${heading}${weatherHtml}`);
        }
        // Increment date for the next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return updatedItinerary;
  };

  const getCurrentPosition = (): Promise<Position> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          () => {
            // Default to Taipei if user denies permission
            console.warn("Geolocation permission denied. Defaulting to Taipei.");
            resolve({ latitude: 25.0330, longitude: 121.5654 });
          }
        );
      }
    });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    const userMessage: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setWaypoints([]);
    setPois([]);

    try {
      const position = await getCurrentPosition();
      const rawResponse = await generateItinerary(prompt, position);
      
      const startDate = parseStartDateFromResponse(rawResponse);
      const newWaypoints = parseWaypointsFromResponse(rawResponse);
      const newPois = parsePoisFromResponse(rawResponse);

      setWaypoints(newWaypoints);
      setPois(newPois);
      
      // Add the message first without weather for a quick response
      const initialAssistantMessage: Message = {
        role: 'assistant',
        content: rawResponse,
      };
      setMessages(prev => [...prev, initialAssistantMessage]);

      // Then, asynchronously fetch weather and update the message
      if (startDate && newWaypoints.length > 0) {
          addWeatherToItinerary(rawResponse, newWaypoints, startDate).then(contentWithWeather => {
            const finalAssistantMessage: Message = {
                role: 'assistant',
                content: contentWithWeather,
            };
            // Replace the last message with the one including weather
            setMessages(prev => [...prev.slice(0, -1), finalAssistantMessage]);
          });
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I ran into an error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
      setPrompt('');
    }
  }, [prompt, isLoading]);

  const handleClearHistory = useCallback(() => {
    setMessages([initialMessage]);
    setWaypoints([]);
    setPois([]);
    setError(null);
  }, []);

  const getModalContent = () => {
    switch (modalContent) {
      case 'about':
        return {
          title: 'About Taiwan Campervan AI Navigator',
          content: (
            <>
               <div className="space-y-4">
                <p>This application is your all-in-one AI planning tool for campervan adventures in Taiwan. It leverages Google's Gemini AI and OpenStreetMap to create customized itineraries tailored to your travel style.</p>
                
                <div>
                  <h3 className="font-semibold text-gray-800">How to Use This App</h3>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li><strong>Plan a Full Trip:</strong> Describe your desired trip in detail. Include duration, start/end points, specific dates, and your interests (e.g., "7-day trip from Taipei to Hualien starting August 1st, 2024, I love hiking and local food"). The AI will generate a complete day-by-day itinerary with weather forecasts and plot the route on the map.</li>
                    <li><strong>Get Specific Recommendations:</strong> If you already have a plan, you can ask for targeted suggestions without generating a new route. For example: "What are the best beef noodle soup restaurants in Tainan?" or "Find campsites near Sun Moon Lake." The map will not change, but you'll get a list of recommendations.</li>
                  </ol>
                </div>

                <p>Developed by skadoosh.ai.lab. For any inquiries, please contact: <a href="mailto:skadoosh.ai.lab@gmail.com" className="text-blue-600 hover:underline">skadoosh.ai.lab@gmail.com</a>.</p>
                
                <div className="mt-6">
                  <a 
                    href="https://www.camperoadtaiwan.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-block bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition-colors no-underline"
                  >
                    Camper Road Taiwan
                  </a>
                </div>
              </div>
            </>
          )
        };
      case 'privacy':
        return {
          title: 'Privacy Policy',
          content: (
            <>
              <p className="font-semibold text-gray-900">This application is designed with your privacy as a top priority. We do not collect, store, or share any of your personal data.</p>
              <ul className="list-disc list-inside space-y-2 mt-4">
                <li><strong>No Data Collection:</strong> This app is stateless. We do not have a database, and we do not save your prompts, your location, or your generated itineraries. Your session data exists only in your browser and is gone when you clear the history or close the tab.</li>
                <li><strong>How Your Data is Used:</strong> To function, the information you provide is sent directly to third-party services for real-time processing:
                  <ul className="list-disc list-inside ml-5 mt-2">
                      <li><strong>Google's Gemini API:</strong> Processes your text prompt to generate the travel itinerary.</li>
                      <li><strong>Open-Meteo API:</strong> Uses location coordinates and dates from the itinerary to fetch weather forecasts.</li>
                  </ul>
                </li>
                <li><strong>Your Control:</strong> You are in complete control. No data is ever sent to our servers because we do not operate any.</li>
                <li><strong>Third-Party Policies:</strong> Your interactions are subject to the privacy policies of Google and Open-Meteo.</li>
              </ul>
              <p className="mt-4">Our sole purpose is to help you plan your trip. We have no interest in your data. By using this application, you acknowledge this data handling process.</p>
               <p className="mt-4">For any inquiries about your privacy, please contact: <a href="mailto:skadoosh.ai.lab@gmail.com" className="text-blue-600 hover:underline">skadoosh.ai.lab@gmail.com</a>.</p>
            </>
          )
        };
      case 'safety':
        return {
          title: 'Campervan Safety Tips',
          content: (
            <>
              <p>Driving a campervan can be a fantastic experience, but safety should always be your top priority. Here are some essential guidelines for a safe trip around Taiwan:</p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li><strong>Do not drink and drive.</strong> Taiwan has a zero-tolerance policy for driving under the influence of alcohol.</li>
                <li><strong>Be aware of wildlife.</strong> Especially when driving at night in mountainous or rural areas, be cautious of animals crossing the road.</li>
                <li><strong>Check vehicle height.</strong> Be mindful of height restrictions in underpasses, tunnels, and indoor parking lots. Always prefer open-air parking and pay close attention to road signs.</li>
                <li><strong>Manage your speed.</strong> Campervans are heavier and have a higher center of gravity than cars. Drive at a moderate speed, especially on winding mountain roads and in strong winds.</li>
                <li><strong>Secure your belongings.</strong> Before driving, make sure all items inside the campervan are securely stowed away to prevent them from moving and becoming projectiles.</li>
                <li><strong>Plan your stops.</strong> Long drives can be tiring. Plan for regular breaks to rest and stay alert.</li>
              </ul>
            </>
          )
        };
      default:
        return { title: '', content: null };
    }
  };

  const { title: modalTitle, content: modalBody } = getModalContent();

  return (
    <div className="flex h-screen w-screen font-sans text-gray-800">
      <SidePanel
        messages={messages}
        prompt={prompt}
        setPrompt={setPrompt}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        onShowModal={setModalContent}
        onClearHistory={handleClearHistory}
      />
      <main className="flex-1 h-full">
        <MapComponent waypoints={waypoints} pois={pois} />
      </main>
      <Modal 
        isOpen={!!modalContent} 
        onClose={() => setModalContent(null)}
        title={modalTitle}
      >
        {modalBody}
      </Modal>
    </div>
  );
};

export default App;