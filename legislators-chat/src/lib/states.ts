/**
 * US State utilities
 *
 * Maps state abbreviations to full names and flag image URLs.
 * Flag images sourced from Wikimedia Commons (public domain).
 */

import type { StateAbbreviation } from "./types";

/** Map of state abbreviations to full state names */
export const STATE_NAMES: Record<StateAbbreviation, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
  PR: "Puerto Rico",
  GU: "Guam",
  VI: "U.S. Virgin Islands",
  AS: "American Samoa",
  MP: "Northern Mariana Islands",
};

/**
 * State flag URLs from Wikimedia Commons (public domain)
 * Using small thumbnail versions (45px height) for performance
 */
export const STATE_FLAGS: Record<StateAbbreviation, string> = {
  AL: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_Alabama.svg/67px-Flag_of_Alabama.svg.png",
  AK: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Flag_of_Alaska.svg/68px-Flag_of_Alaska.svg.png",
  AZ: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Flag_of_Arizona.svg/67px-Flag_of_Arizona.svg.png",
  AR: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Flag_of_Arkansas.svg/67px-Flag_of_Arkansas.svg.png",
  CA: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Flag_of_California.svg/67px-Flag_of_California.svg.png",
  CO: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Flag_of_Colorado.svg/67px-Flag_of_Colorado.svg.png",
  CT: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Flag_of_Connecticut.svg/62px-Flag_of_Connecticut.svg.png",
  DE: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Flag_of_Delaware.svg/67px-Flag_of_Delaware.svg.png",
  FL: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Flag_of_Florida.svg/67px-Flag_of_Florida.svg.png",
  GA: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Flag_of_Georgia_%28U.S._state%29.svg/67px-Flag_of_Georgia_%28U.S._state%29.svg.png",
  HI: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Flag_of_Hawaii.svg/67px-Flag_of_Hawaii.svg.png",
  ID: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_Idaho.svg/57px-Flag_of_Idaho.svg.png",
  IL: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Flag_of_Illinois.svg/67px-Flag_of_Illinois.svg.png",
  IN: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Flag_of_Indiana.svg/67px-Flag_of_Indiana.svg.png",
  IA: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Flag_of_Iowa.svg/67px-Flag_of_Iowa.svg.png",
  KS: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Flag_of_Kansas.svg/67px-Flag_of_Kansas.svg.png",
  KY: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Flag_of_Kentucky.svg/67px-Flag_of_Kentucky.svg.png",
  LA: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Flag_of_Louisiana.svg/67px-Flag_of_Louisiana.svg.png",
  ME: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Flag_of_Maine.svg/60px-Flag_of_Maine.svg.png",
  MD: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Flag_of_Maryland.svg/67px-Flag_of_Maryland.svg.png",
  MA: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Flag_of_Massachusetts.svg/67px-Flag_of_Massachusetts.svg.png",
  MI: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Flag_of_Michigan.svg/67px-Flag_of_Michigan.svg.png",
  MN: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Minnesota.svg/67px-Flag_of_Minnesota.svg.png",
  MS: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Flag_of_Mississippi.svg/67px-Flag_of_Mississippi.svg.png",
  MO: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Flag_of_Missouri.svg/67px-Flag_of_Missouri.svg.png",
  MT: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Flag_of_Montana.svg/67px-Flag_of_Montana.svg.png",
  NE: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Flag_of_Nebraska.svg/67px-Flag_of_Nebraska.svg.png",
  NV: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Flag_of_Nevada.svg/67px-Flag_of_Nevada.svg.png",
  NH: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Flag_of_New_Hampshire.svg/67px-Flag_of_New_Hampshire.svg.png",
  NJ: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Flag_of_New_Jersey.svg/67px-Flag_of_New_Jersey.svg.png",
  NM: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_New_Mexico.svg/67px-Flag_of_New_Mexico.svg.png",
  NY: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flag_of_New_York.svg/67px-Flag_of_New_York.svg.png",
  NC: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Flag_of_North_Carolina.svg/67px-Flag_of_North_Carolina.svg.png",
  ND: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Flag_of_North_Dakota.svg/57px-Flag_of_North_Dakota.svg.png",
  OH: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Flag_of_Ohio.svg/68px-Flag_of_Ohio.svg.png",
  OK: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Flag_of_Oklahoma.svg/67px-Flag_of_Oklahoma.svg.png",
  OR: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Oregon.svg/67px-Flag_of_Oregon.svg.png",
  PA: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Flag_of_Pennsylvania.svg/67px-Flag_of_Pennsylvania.svg.png",
  RI: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Rhode_Island.svg/56px-Flag_of_Rhode_Island.svg.png",
  SC: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Flag_of_South_Carolina.svg/67px-Flag_of_South_Carolina.svg.png",
  SD: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flag_of_South_Dakota.svg/67px-Flag_of_South_Dakota.svg.png",
  TN: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Flag_of_Tennessee.svg/67px-Flag_of_Tennessee.svg.png",
  TX: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Flag_of_Texas.svg/67px-Flag_of_Texas.svg.png",
  UT: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Flag_of_Utah.svg/67px-Flag_of_Utah.svg.png",
  VT: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Vermont.svg/60px-Flag_of_Vermont.svg.png",
  VA: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Flag_of_Virginia.svg/63px-Flag_of_Virginia.svg.png",
  WA: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Flag_of_Washington.svg/67px-Flag_of_Washington.svg.png",
  WV: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Flag_of_West_Virginia.svg/67px-Flag_of_West_Virginia.svg.png",
  WI: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Flag_of_Wisconsin.svg/67px-Flag_of_Wisconsin.svg.png",
  WY: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Flag_of_Wyoming.svg/67px-Flag_of_Wyoming.svg.png",
  DC: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Flag_of_the_District_of_Columbia.svg/67px-Flag_of_the_District_of_Columbia.svg.png",
  PR: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Flag_of_Puerto_Rico.svg/67px-Flag_of_Puerto_Rico.svg.png",
  GU: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Flag_of_Guam.svg/67px-Flag_of_Guam.svg.png",
  VI: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Flag_of_the_United_States_Virgin_Islands.svg/67px-Flag_of_the_United_States_Virgin_Islands.svg.png",
  AS: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flag_of_American_Samoa.svg/67px-Flag_of_American_Samoa.svg.png",
  MP: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Flag_of_the_Northern_Mariana_Islands.svg/67px-Flag_of_the_Northern_Mariana_Islands.svg.png",
};

/**
 * Get the full name for a state abbreviation
 */
export function getStateName(abbrev: StateAbbreviation): string {
  return STATE_NAMES[abbrev] || abbrev;
}

/**
 * Get the flag URL for a state abbreviation
 */
export function getStateFlag(abbrev: StateAbbreviation): string {
  return STATE_FLAGS[abbrev];
}
