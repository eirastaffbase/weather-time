/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { UiSchema } from "@rjsf/utils";
import { JSONSchema7 } from "json-schema";

/**
 * schema used for generation of the configuration dialog
 * see https://rjsf-team.github.io/react-jsonschema-form/docs/ for documentation
 */
export const configurationSchema: JSONSchema7 = {
  properties: {
    city: {
      type: 'string',
      title: 'City',
      default: '{{user.profile.location}}',
    },
    allowcityoverride: {
      type: "boolean",
      title: "Allow city override?",
      default: true,
    },
    mobileview: {
      type: "boolean",
      title: "Mobile view",
      default: false,
    },
    usenewimages: {
      type: "boolean",
      title: "Use new images?",
      default: false,
      description: "Use the new weather icons instead of the old ones.",
    },
    userealisticimages: {
      type: "boolean",
      title: "Use realistic images?",
      default: false,
      description: "Use the realistic photo-style weather icons.",
    },
  },
  required: ['city'],
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
export const uiSchema: UiSchema = {
  city: {
    'ui:help': 'Enter the city name, or use {{user.profile.location}} to pull from the user.',
  },
  allowcityoverride: {
    "ui:help":
      "If checked, a small button in the widget will let the user override the city.",
  },
  mobileview: {
    "ui:help":
      "Hide the date and time to simplify the widget for mobile.",
  },
  usenewimages: {
    "ui:help":
      "Use the new weather icons instead of the old ones. This will be the default in the future.",
  },
  userealisticimages: {
    "ui:help":
      "Use the realistic photo-style weather icons. Uses default image sizing.",
  },

};
