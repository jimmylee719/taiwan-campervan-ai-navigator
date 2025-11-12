import { GoogleGenAI, Type } from "@google/genai";
import { Position, Poi, Waypoint } from '../types';

// The API key is securely managed by the environment and is not hardcoded here.
// Ensure the API_KEY environment variable is set in your deployment environment.
// FIX: Initialize GoogleGenAI directly with the environment variable and remove the explicit check,
// as per the library's best practices assuming the key is always present.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// FIX: Updated the system instruction to work with JSON mode for more reliable output.
const SYSTEM_INSTRUCTION = `You are the 'Taiwan Campervan AI Navigator', a specialized AI assistant for planning campervan trips in Taiwan. Your primary goal is to generate a comprehensive, accurate, and safe day-by-day itinerary inside the 'itinerary' property of the JSON response.

**Your main task is to create a CONCISE and easy-to-read plan.** Users want the highlights, not a wall of text. The user MUST provide a start date for their trip.

**Core Directive:** Analyze the user's prompt for keywords to tailor the itinerary.
- If the user mentions 'history' or 'culture', prioritize historical sites.
- If the user mentions 'ocean', 'beaches', or 'coast', design a coastal route.
- If the user mentions 'food' or 'restaurants', incorporate stops at local markets.
- If the user mentions 'mountains' or 'hiking', focus on scenic mountain roads.
- If the prompt is general, create a balanced itinerary with must-see attractions.
- **Two Modes:** Determine if the user wants a full itinerary or just specific recommendations. If they ask for recommendations (e.g., "restaurants in Tainan"), provide a list of POIs and a simple text response in the itinerary property, but leave waypoints empty to avoid changing the map route.

You MUST follow these rules for the itinerary markdown:
1.  **Format:** Generate the itinerary in clear, engaging markdown. Use headings for days (e.g., '## Day 1: Taipei to Yilan').
2.  **Clickable POIs:** For every point of interest, format it as a clickable Google Maps link. To ensure accuracy, the link's search query MUST include both the name and its city or district. Use the address information you've gathered for the POI to make the query specific. Example: \`[Taipei 101](https://www.google.com/maps/search/?api=1&query=Taipei+101,Xinyi+District,Taipei)\`.
3.  **Concise Campervan Info:** Keep utility information brief. For each day, suggest:
    - A single, primary **campervan-friendly campsite (露營車營地)**.
    - A **campervan-friendly parking** spot if the day's main attraction is in a busy area.
    - **Do not list** individual gas stations, toilets, or supermarkets.
4.  **Safety First:**
    - On **each day's plan**, include a '#### Driving Safety Reminder'. Mention that the route is for standard cars and advise the driver to always watch for road signs indicating **height restrictions (限高)**.
    - On the **first day's plan**, include a '### Trip Kick-off Checklist'. Provide emergency numbers: Police (110), Ambulance/Fire (119), and the Tourist Information Hotline (0800-011-765).
    - On the **last day's plan**, include a '### Trip Wrap-up' section with reminders to clean the van and refuel.

Your entire response MUST be a single JSON object matching the provided schema.`;

// FIX: Defined a response schema to enable Gemini's JSON mode.
const responseSchema = {
    type: Type.OBJECT,
    properties: {
        itinerary: {
            type: Type.STRING,
            description: "The full day-by-day itinerary in Markdown format."
        },
        startDate: {
            type: Type.STRING,
            description: "The start date of the trip in YYYY-MM-DD format. Extract this from the user's prompt."
        },
        waypoints: {
            type: Type.ARRAY,
            description: "A JSON array of objects for the main cities that define the driving route, including their coordinates.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                },
                required: ["name", "lat", "lng"],
            }
        },
        pois: {
            type: Type.ARRAY,
            description: "A JSON array of objects for all recommended locations with their names, specific addresses, and coordinates for map marking.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    address: { type: Type.STRING },
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                },
                required: ["name", "address", "lat", "lng"],
            }
        }
    },
    required: ["itinerary", "startDate", "waypoints", "pois"]
};

export interface ItineraryResponse {
    itinerary: string;
    startDate: string | null;
    waypoints: Waypoint[];
    pois: Poi[];
}

// FIX: Updated function to use JSON mode and return a structured object.
export const generateItinerary = async (prompt: string, position: Position): Promise<ItineraryResponse> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
    });
    
    const jsonResponse = JSON.parse(response.text);
    return {
        itinerary: jsonResponse.itinerary || '',
        startDate: jsonResponse.startDate || null,
        waypoints: jsonResponse.waypoints || [],
        pois: jsonResponse.pois || [],
    };
  } catch (error) {
    console.error("Error generating itinerary:", error);
    const err = error instanceof Error ? error.message : String(error);
    if (err.includes('API key not valid')) {
       throw new Error("The Gemini API key is invalid. Please check your environment variable configuration.");
    }
    throw new Error("Failed to get a response from the AI. Please try again.");
  }
};
