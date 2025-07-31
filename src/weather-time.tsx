/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, useState, useEffect, useRef } from "react";
import { BlockAttributes } from "widget-sdk";
import { DateTime } from "luxon";

/**
 * Map WeatherAPI `code` + day/night => custom SVG filenames
 * ------------------------------------------------------------------------
 * WeatherAPI returns a numeric `code` for the condition (e.g., 1000 for "Clear"),
 * plus an indication of day or night. This function maps those to the custom
 * SVG filename that should be displayed in the UI.
 */
function getIconFilename(code: number, timeOfDay: "day" | "night"): string {
  switch (code) {
    case 1000:
      return timeOfDay === "day" ? "sunny.svg" : "clear-moon.svg";
    case 1003:
      return timeOfDay === "day" ? "partly-cloudy-sun.svg" : "partly-cloudy-moon.svg";
    case 1006:
      return "cloudy.svg";
    case 1009:
      return "double-clouds.svg";
    case 1030:
    case 1135:
    case 1147:
      return "double-clouds.svg";
    case 1063:
    case 1072:
    case 1150:
    case 1153:
    case 1168:
    case 1171:
      return timeOfDay === "day" ? "drizzle.svg" : "drizzle-moon.svg";
    case 1180:
    case 1183:
    case 1186:
    case 1189:
    case 1192:
    case 1195:
    case 1198:
    case 1201:
    case 1240:
    case 1243:
    case 1246:
      return "rain.svg";
    case 1066:
    case 1069:
    case 1114:
    case 1117:
    case 1204:
    case 1207:
    case 1210:
    case 1213:
    case 1216:
    case 1219:
    case 1222:
    case 1225:
    case 1237:
    case 1249:
    case 1252:
    case 1255:
    case 1258:
    case 1261:
    case 1264:
      return "snow.svg";
    case 1087:
    case 1273:
    case 1276:
    case 1279:
    case 1282:
      return "thunderstorm.svg";
    default:
      return "default.svg";
  }
}

/**
 * Format a Luxon DateTime object into a short string, e.g.:
 * "Nov 26th, 9:05am"
 */
function formatDateTime(dt: DateTime): string {
  // Example: dt.toFormat("LLL") => short month name like "Nov"
  const monthShort = dt.toFormat("LLL");
  // The numeric day of the month, e.g. 26
  const day = dt.day;
  // 24-hour value; we'll convert to 12-hour below.
  const hours24 = dt.hour;
  // Convert to 12-hour format (1-12)
  const hours12 = hours24 % 12 || 12;
  // Get the minutes
  const minutes = dt.minute;
  // AM/PM check
  const ampm = hours24 >= 12 ? "pm" : "am";

  // For ordinal suffix (st, nd, rd, th),
  // e.g. 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 4 -> 4th, etc.
  function getOrdinalSuffix(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) return "st";
    if (n % 10 === 2 && n % 100 !== 12) return "nd";
    if (n % 10 === 3 && n % 100 !== 13) return "rd";
    return "th";
  }
  const suffix = getOrdinalSuffix(day);

  // Pad minutes to 2 digits (e.g., "05" if it's 5 minutes after the hour)
  const minStr = minutes.toString().padStart(2, "0");

  // Build up the final string, e.g. "Nov 26th, 9:05am"
  return `${monthShort} ${day}${suffix}, ${hours12}:${minStr}${ampm}`;
}

/**
 * The React component properties
 */
export interface WeatherTimeProps extends BlockAttributes {
  city: string; // The city for which to display weather/time
  apikey: string; // WeatherAPI key
  allowcityoverride: boolean;
  mobileview: boolean;
  usenewimages: boolean;
}

/**
 * Main WeatherTime component
 * ------------------------------------------------------------------------
 * 1) Fetch weather data from WeatherAPI (including the `tz_id` for local time).
 * 2) Use Luxon to get the current time in that tz_id.
 * 3) Render the temperature, condition, and time.
 * 4) (Optional) allow user to override city if allowcityoverride is true.
 */
export const WeatherTime = (props: WeatherTimeProps): ReactElement => {
  // A ref to the container div, if needed for future usage
  const containerRef = useRef<HTMLDivElement>(null);
  // Destructure the relevant props

  /**
   * Decide if we're in "mobile" mode based on prop.
   * The prop can be "true" (string), "false" (string), or a boolean.
   */
  const isMobileView =
    mobileview === "true" ? true : mobileview === "false" ? false : Boolean(mobileview);

  /**
   * Decide if city override is allowed similarly.
   */
  const isCityOverrideAllowed =
    allowcityoverride === "true"
      ? true
      : allowcityoverride === "false"
      ? false
      : Boolean(allowcityoverride);

  // Various pieces of state for weather info
  const [condition, setCondition] = useState<string>("Loading...");
  const [iconUrl, setIconUrl] = useState<string>("");
  const [temperatureC, setTemperatureC] = useState<number | null>(null);
  const [temperatureF, setTemperatureF] = useState<number | null>(null);
  const [isFahrenheit, setIsFahrenheit] = useState<boolean>(false);

  // The "tz_id" from WeatherAPI (e.g., "America/New_York")
  const [timeZone, setTimeZone] = useState<string>("");

  // We'll store the current time (in that time zone) as a Luxon DateTime
  const [localTime, setLocalTime] = useState<DateTime | null>(null);

  // Loading state for the spinner overlay
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State for city override popup
  const [overrideCity, setOverrideCity] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [overrideInput, setOverrideInput] = useState<string>("");

  // Default fallback values, in case we can't fetch data
  const defaultCity = "New York City";
  const defaultCondition = "Patchy light snow";
  const defaultTemperatureC = 27;
  const defaultTemperatureF = (27 * 9) / 5 + 32;

  // For icons - Define both potential paths
  const GITHUB_WEATHER_PATH =
    "https://eirastaffbase.github.io/weather-time/resources/img";
  const WIDGET_IMAGES_PATH =
    "https://eirastaffbase.github.io/widget-images/weather-time";

  const useNewImagesParsed = usenewimages === true || usenewimages === "true";

  const imageBasePath = useNewImagesParsed ? WIDGET_IMAGES_PATH : GITHUB_WEATHER_PATH;

  // Set the default fallback icon using the selected base path
  const fallbackGHDefault = `${imageBasePath}/default.svg`;
  // Decide which city name to actually use (override or prop)
  const displayCity = overrideCity || city || defaultCity;

  // Additional metadata from WeatherAPI (e.g., region/country)
  const [cityName, setCity] = useState<string>(displayCity);
  const [region, setRegion] = useState<string>("");
  const [country, setCountry] = useState<string>("");

  /**
   * Fetch weather from WeatherAPI, store temperature, condition, tz_id, etc.
   * We rely on tz_id so that we can let Luxon handle the actual time in that zone.
   */
  const fetchWeatherData = async () => {
    try {
      // Use the provided apikey prop instead of hardcoding
      if (!apikey || apikey.trim() === '') {
      console.error("Weather API key is not provided in configuration.", apikey);
      throw new Error("API key is required");
    }

      // Build the URL
      const response = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${apikey}&q=${encodeURIComponent(
          displayCity
        )}`
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Parse JSON
      const data = await response.json();

      // Check if the response includes the necessary fields
      if (data && data.current && data.current.condition) {
        // Temperatures (C and F)
        setTemperatureC(data.current.temp_c);
        setTemperatureF(data.current.temp_f);

        // By default, set Fahrenheit if the country is "United States of America"
        setIsFahrenheit(data.location?.country === "United States of America");

        // Figure out the correct weather icon to show
        const weatherCode = data.current.condition.code || 1000;
        const timeOfDay = data.current.is_day === 1 ? "day" : "night";
        const filename = getIconFilename(weatherCode, timeOfDay);
        // Use the dynamically selected imageBasePath
        setIconUrl(`${imageBasePath}/${filename}`);

        // WeatherAPI also returns a tz_id, e.g. "America/New_York" or "Europe/London"
        if (data.location?.tz_id) {
          setTimeZone(data.location.tz_id);
        } else {
          // fallback if missing
          setTimeZone("UTC");
        }

        // Store city/region/country for UI
        if (data.location) {
          setCity(data.location.name);
          setRegion(data.location.region);
          setCountry(data.location.country);
        }

        return data.location;
      } else {
        // If invalid data, throw an Error
        throw new Error("Invalid data received from weather API");
      }
    } catch (error) {
      console.error("Error fetching weather data:", error);

      // Fallback to default weather if something goes wrong
      setCondition(defaultCondition.toLowerCase());
      setTemperatureC(defaultTemperatureC);
      setTemperatureF(defaultTemperatureF);
      setIsFahrenheit(false);
      setIconUrl(`${imageBasePath}/default.svg`);

      // We'll just use UTC time as a fallback
      setTimeZone("UTC");

      return null;
    }
  };

  /**
   * Helper function that calls `fetchWeatherData` and manages loading state
   */
  const fetchWeatherAndTime = async () => {
    setIsLoading(true);
    await fetchWeatherData();
    setIsLoading(false);
  };

  /**
   * When the component first mounts (and whenever `displayCity` changes),
   * fetch the weather info for that city.
   */
  useEffect(() => {
    fetchWeatherAndTime();
    console.log(usenewimages);
    console.log(imageBasePath);
  }, [displayCity]);

  /**
   * Once we know the time zone, we can set the localTime using Luxon.
   */
  useEffect(() => {
    if (!timeZone) return; // if no tz yet, do nothing

    // Set the time right away
    setLocalTime(DateTime.now().setZone(timeZone));

    // Then, update once per minute
    const interval = setInterval(() => {
      setLocalTime(DateTime.now().setZone(timeZone));
    }, 6000);

    return () => clearInterval(interval);
  }, [timeZone]);

  /**
   * Toggle between Celsius and Fahrenheit on click
   */
  const toggleTemperatureUnit = () => {
    setIsFahrenheit((prev) => !prev);
  };

  /**
   * Manually refresh all weather/time data when user clicks something
   */
  const handleRefresh = () => {
    fetchWeatherAndTime();
  };

  /**
   * Handle city override: user can type a new city and click "OK",
   * then we store that city in state, and the effect above will re-fetch
   */
  const handleSetCityOverride = () => {
    setOverrideCity(overrideInput.trim() || null);
    setShowPopup(false);
  };

  /**
   * Decide which temperature to display (C or F)
   */
  const temperature = isFahrenheit ? temperatureF : temperatureC;

  /**
   * Format the localTime if available, or show a loading string
   */
  const dateTimeString = localTime ? formatDateTime(localTime) : "Loading time...";

  /**
   * Container style - different if in mobile vs. desktop layout
   */
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: isMobileView ? "column" : "row",
    justifyContent: isMobileView ? "flex-end" : "space-between",
    alignItems: isMobileView ? "flex-end" : "flex-start",
    padding: "10px",
    position: "relative",
    textAlign: isMobileView ? "right" : "left",
  };

  // Determine the image width based on useNewImagesParsed
  const imageWidthMobile = useNewImagesParsed ? "130px" : "105px";
  const imageWidthDesktop = useNewImagesParsed ? "230px" : "165px";

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Loading overlay (optional):
        If you'd like to show a spinner while fetching, uncomment this block.
      */}
      {/* {isLoading && (
        <div
          style={{
            position: "absolute",
            top: -20,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isMobileView
              ? "rgba(255,255,255,0)"
              : "rgba(255,255,255,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          <img
            src="https://eirastaffbase.github.io/weather-time/resources/img/loading.gif"
            alt="loading"
            style={{ width: "30px" }}
          />
        </div>
      )} */}

      {/* MOBILE LAYOUT
        ------------------------------------------------------------------
        If isMobileView is true, we show icon first, then temperature,
        and skip showing the time. (Though you could easily adjust if you want.)
      */}
      {isMobileView && (
        <>
          {/* Weather Icon */}
          {iconUrl && (
            <div
              style={{ 
                marginBottom: useNewImagesParsed ? "0px" : "10px", 
                cursor: "pointer",
              }}
              onClick={handleRefresh}
            >
              <img
                src={iconUrl}
                alt="Weather Icon"
                style={{
                  width: imageWidthMobile,
                }}
                              onError={(e) => {
                  const imgEl = e.currentTarget as HTMLImageElement;
                  // If the icon fails to load from the standard path,
                  // attempt a fallback from GitHub, then a default icon
                  if (!imgEl.dataset.fallback) {
                    imgEl.dataset.fallback = "true";
                    const filenameFromLocalPath = iconUrl.split("/").pop();
                    imgEl.src = `${imageBasePath}/${filenameFromLocalPath}`;
                  } else if (!imgEl.dataset.fallback2) {
                    imgEl.dataset.fallback2 = "true";
                    imgEl.src = fallbackGHDefault;
                  } else {
                    console.warn("All icon fallbacks failed. Stopping.");
                  }
                }}
              />
            </div>
          )}

          {/* Temperature (C or F) */}
          {temperature !== null && (
            <p
              onClick={toggleTemperatureUnit}
              style={{
                cursor: "pointer",
                fontSize: "26px",
                fontWeight: "500",
                margin: useNewImagesParsed ? "0px 33px 0px 0px" : "0px 15px 0px 0px",
              }}
            >
              {Math.round(temperature)}°{isFahrenheit ? "F" : "C"}
            </p>
          )}
        </>
      )}

      {/* DESKTOP LAYOUT
        ------------------------------------------------------------------
        If NOT mobileView, we show time and temperature side by side,
        with the weather icon on the right.
      */}
      {!isMobileView && (
        <>
          {/* Left side: Temperature & date/time */}
          <div style={{ marginBottom: useNewImagesParsed ? "-15px" : "0px" }}>
            {/* Temperature */}
            {temperature !== null && (
              <p
                onClick={toggleTemperatureUnit}
                style={{
                  cursor: "pointer",
                  fontSize: "32px",
                  fontWeight: "bold",
                  margin: "0 0 10px 0",
                }}
              >
                {Math.round(temperature)}°{isFahrenheit ? "F" : "C"}
              </p>
            )}

            {/* Show date/time (no seconds in the format) */}
            <p
              onClick={handleRefresh}
              style={{ fontSize: "16px", margin: "0 0 10px 0" }}
            >
              {dateTimeString}
            </p>
          </div>

          {/* Right side: Weather icon */}
          {iconUrl && (
            <div
              style={{
                marginTop: "-20px",
                marginLeft: "20px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <img
                src={iconUrl}
                onClick={handleRefresh}
                alt="Weather Icon"
                style={{ width: imageWidthDesktop, 
                  marginTop: useNewImagesParsed ? "-65px" : "-60px",
                  marginLeft: useNewImagesParsed ? "-10px" : "-5px",
                              }}
                onError={(e) => {
                  const imgEl = e.currentTarget as HTMLImageElement;
                  // fallback icon logic, just like above
                  if (!imgEl.dataset.fallback) {
                    imgEl.dataset.fallback = "true";
                    const filenameFromLocalPath = iconUrl.split("/").pop();
                    imgEl.src = `${imageBasePath}/${filenameFromLocalPath}`;
                  } else if (!imgEl.dataset.fallback2) {
                    imgEl.dataset.fallback2 = "true";
                    imgEl.src = fallbackGHDefault;
                  } else {
                    console.warn("All icon fallbacks failed. Stopping.");
                  }
                }}
              />
            </div>
          )}
        </>
      )}

      {/* OPTIONAL "..." button to open a city override popup if allowed
      */}
      {isCityOverrideAllowed && (
        <div
          onClick={() => setShowPopup(true)}
          style={{
            position: "absolute",
            bottom: "5px",
            right: "5px",
            cursor: "pointer",
            opacity: 0.5,
          }}
        >
          <p>...</p>
        </div>
      )}

      {/* City override popup:
        Lets user type in a different city name, e.g. "London", "Paris", etc.
      */}
      {showPopup && (
        <div
          style={{
            position: "absolute",
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "6px",
              minWidth: "250px",
            }}
          >
            <p>
              <b>Current City:</b> {cityName}
              {region ? `, ${region}` : ""}
              {country ? `, ${country}` : ""}
            </p>
            <input
              type="text"
              placeholder="Type a city..."
              value={overrideInput}
              onChange={(e) => setOverrideInput(e.target.value)}
              style={{ width: "100%", marginBottom: "10px", marginTop: "10px" }}
            />
            <div>
              <button onClick={handleSetCityOverride} style={{ marginBottom: "10px" }}>
                OK
              </button>
              <button onClick={() => setShowPopup(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};