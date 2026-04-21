import React from "react"
import {screen, render} from "@testing-library/react"

import {WeatherTime} from "./weather-time-geolocation";

describe("WeatherTime", () => {
    it("should render the component", () => {
        render(<WeatherTime contentLanguage="en_US" city="New York" allowcityoverride="true"/>);

        expect(screen.getByText(/Hello World/)).toBeInTheDocument();
    })
})
