"use client";
import GCal from "/Google_Calendar_icon_(2020).svg.png"
import { OAuth } from "./oauth";
// Using named export instead of default export in case of multiple exports and seems to be industry standard

export function AuthButton(){
    return(
        //Visual display
        <div>
            <button onClick={OAuth} className="hover:drop-shadow-md hover:bg-gray-100 transition-colors duration-200 justify-center items-center flex gap-2 bg-white border-2 rounded-full p-4 w-full max-w-md">
                <img className="w-9 h-9" src={GCal} alt="Google Calendar Icon"/>
                <h2 className="text-black font-medium">Sign in with Google</h2>
            </button>
        </div>
    )
}