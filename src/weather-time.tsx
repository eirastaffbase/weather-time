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

/**
 * Map WeatherAPI `code` + day/night => custom SVG filenames
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
      return "mist.svg";
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
 * Format date/time as "Nov 26th, 9:05am"
 */
function formatDateTime(date: Date): string {
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const hours = date.getHours() % 12 || 12;
  const minutes = date.getMinutes();
  const ampm = date.getHours() >= 12 ? "pm" : "am";

  const getOrdinalSuffix = (n: number): string => {
    if (n % 10 === 1 && n % 100 !== 11) return "st";
    if (n % 10 === 2 && n % 100 !== 12) return "nd";
    if (n % 10 === 3 && n % 100 !== 13) return "rd";
    return "th";
  };
  const suffix = getOrdinalSuffix(day);

  const timeString = `${hours}:${minutes.toString().padStart(2, "0")}${ampm}`;
  return `${month} ${day}${suffix}, ${timeString}`;
}

export interface WeatherTimeProps extends BlockAttributes {
  city: string;
  allowcityoverride: boolean; 
  mobileview: boolean;
}

export const WeatherTime = (props: WeatherTimeProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { city, allowcityoverride, mobileview } = props;

  // Figure out if we are in "mobile" mode
  const isMobileView =
    mobileview === "true" ? true : mobileview === "false" ? false : Boolean(mobileview);

  const isCityOverrideAllowed =
    allowcityoverride === "true"
      ? true
      : allowcityoverride === "false"
      ? false
      : Boolean(allowcityoverride);

  // State
  const [condition, setCondition] = useState<string>("Loading...");
  const [iconUrl, setIconUrl] = useState<string>("");
  const [temperatureC, setTemperatureC] = useState<number | null>(null);
  const [temperatureF, setTemperatureF] = useState<number | null>(null);
  const [isFahrenheit, setIsFahrenheit] = useState<boolean>(false);
  const [localTime, setLocalTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [overrideCity, setOverrideCity] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [overrideInput, setOverrideInput] = useState<string>("");

  // Defaults
  const defaultCity = "New York City";
  const defaultCondition = "Patchy light snow";
  const defaultTemperatureC = 27;
  const defaultTemperatureF = (27 * 9) / 5 + 32;

  // For icon path
  const LOCAL_BASE = "./img";
  const GITHUB_WEATHER_PATH =
    "https://eirastaffbase.github.io/weather-time/resources/img";
  const fallbackGHDefault = `${GITHUB_WEATHER_PATH}/default.svg`;

  const displayCity = overrideCity || city || defaultCity;

  const [cityName, setCity] = useState<string>(displayCity);
  const [region, setRegion] = useState<string>("");
  const [country, setCountry] = useState<string>("");

  // Fetch weather & time
  const fetchWeatherData = async () => {
    try {
      const apiKey = "2316f440769c440d92051647240512";
      if (!apiKey) {
        console.error("Weather API key is not set.");
        return;
      }

      const response = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(
          displayCity
        )}`
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();

      if (data && data.current && data.current.condition) {
        setCondition(data.current.condition.text.toLowerCase());
        setTemperatureC(data.current.temp_c);
        setTemperatureF(data.current.temp_f);
        setIsFahrenheit(data.location?.country === "United States of America");

        const weatherCode = data.current.condition.code || 1000;
        const timeOfDay = data.current.is_day === 1 ? "day" : "night";
        const filename = getIconFilename(weatherCode, timeOfDay);
        setIconUrl(`${GITHUB_WEATHER_PATH}/${filename}`);

        if (data.location?.localtime) {
          setLocalTime(new Date(data.location.localtime));
        } else {
          setLocalTime(new Date());
        }

        if (data.location) {
          setCity(data.location.name);
          setRegion(data.location.region);
          setCountry(data.location.country);
        }

        return data.location; // return location data for time fetch
      } else {
        throw new Error("Invalid data received from weather API");
      }
    } catch (error) {
      console.error("Error fetching weather data:", error);
      setCondition(defaultCondition.toLowerCase());
      setTemperatureC(defaultTemperatureC);
      setTemperatureF(defaultTemperatureF);
      setIsFahrenheit(false);
      setIconUrl(`${GITHUB_WEATHER_PATH}/default.svg`);
      return null; // return null if weather fetch fails
    }
  };

  const fetchTimeData = async (locationData: any) => {
    if (!locationData || isMobileView) return; // Do not fetch if location or mobile

    try {
      const { lat, lon } = locationData;
      const timeResponse = await fetch(
        `https://timeapi.io/api/Time/current/coordinate?latitude=${encodeURIComponent(
          lat
        )}&longitude=${encodeURIComponent(lon)}`
      );
      if (timeResponse.ok) {
        const timeData = await timeResponse.json();
        if (timeData.dateTime) {
          setLocalTime(new Date(timeData.dateTime));
        } else {
          setLocalTime(new Date());
        }
      } else {
        setLocalTime(new Date());
      }
    } catch (error) {
      console.error("Error fetching time data:", error);
      setLocalTime(new Date()); // fallback to local time, but do not set weather to defaults
    }
  };

  const fetchWeatherAndTime = async () => {
    setIsLoading(true);
    const locationData = await fetchWeatherData();
    await fetchTimeData(locationData);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchWeatherAndTime();
  }, [displayCity]);

  // Start a live clock once localTime is set
  const clockStartedRef = useRef(false);
  useEffect(() => {
    if (!localTime || clockStartedRef.current) return;
    clockStartedRef.current = true;

    const interval = setInterval(() => {
      setLocalTime((prev) => {
        if (!prev) return prev;
        return new Date(prev.getTime() + 1000);
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clockStartedRef.current = false;
    };
  }, [localTime]);

  // Refresh weather data every 10 minutes
  useEffect(() => {
    const weatherInterval = setInterval(() => {
      fetchWeatherAndTime();
    }, 600000); // 10 minutes
    return () => clearInterval(weatherInterval);
  }, []);

  // Toggle temperature unit
  const toggleTemperatureUnit = () => {
    setIsFahrenheit((prev) => !prev);
  };

  // Manual refresh on click
  const handleRefresh = () => {
    fetchWeatherAndTime();
  };

  // City override popup
  const handleSetCityOverride = () => {
    setOverrideCity(overrideInput.trim() || null);
    setShowPopup(false);
  };

  // Current data for quick use
  const temperature = isFahrenheit ? temperatureF : temperatureC;
  const dateTimeString = localTime
    ? formatDateTime(localTime)
    : formatDateTime(new Date());

  // Container style differs for mobile vs. desktop
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: isMobileView ? "column" : "row",
    flexWrap: "nowrap",
    justifyContent: isMobileView ? "flex-end" : "space-between",
    alignItems: isMobileView ? "flex-end" : "flex-start",
    padding: "10px",
    position: "relative",
    textAlign: isMobileView ? "right" : "left",
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: -20,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isMobileView ? "rgba(255,255,255,0)" : "rgba(255,255,255,0.7)",
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
      )}

      {/* MOBILE LAYOUT (if isMobileView) */}
      {isMobileView && (
        <>
          {/* Weather Icon first */}
          {iconUrl && (
            <div
              style={{ marginBottom: "10px", cursor: "pointer" }}
              onClick={handleRefresh}
            >
              <img
                src={iconUrl}
                alt="Weather Icon"
                style={{ width: "105px" }}
                onError={(e) => {
                  const imgEl = e.currentTarget as HTMLImageElement;
                  if (!imgEl.dataset.fallback) {
                    imgEl.dataset.fallback = "true";
                    const filenameFromLocalPath = iconUrl.split("/").pop();
                    imgEl.src = `${GITHUB_WEATHER_PATH}/${filenameFromLocalPath}`;
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

          {/* Temperature next (stacked below icon), no date */}
          {temperature !== null && (
            <p
              onClick={toggleTemperatureUnit}
              style={{
                cursor: "pointer",
                fontSize: "26px",
                fontWeight: "600",
                margin: "0px 15px 0px 0px",
              }}
            >
              {Math.round(temperature)}°{isFahrenheit ? "F" : "C"}
            </p>
          )}
        </>
      )}

      {/* DESKTOP LAYOUT (if NOT isMobileView) */}
      {!isMobileView && (
        <>
          {/* Left block: Temperature & date/time */}
          <div style={{ marginBottom: 0 }}>
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
            {/* Show date/time in desktop only */}
            <p
              onClick={handleRefresh}
              style={{ fontSize: "16px", margin: "0 0 10px 0" }}
            >
              {dateTimeString}
            </p>
          </div>

          {/* Weather Icon on the right */}
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
                style={{ width: "165px", marginTop: "-60px", marginLeft: "-5px" }}
                onError={(e) => {
                  const imgEl = e.currentTarget as HTMLImageElement;
                  if (!imgEl.dataset.fallback) {
                    imgEl.dataset.fallback = "true";
                    const filenameFromLocalPath = iconUrl.split("/").pop();
                    imgEl.src = `${GITHUB_WEATHER_PATH}/${filenameFromLocalPath}`;
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

      {/* "..." button for city override */}
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

      {/* Popup for city override */}
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