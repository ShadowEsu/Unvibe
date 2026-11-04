/**
 * Open-source notices for code the site ships to browsers, shown on /licenses. glisse's MIT licence asks that its
 * copyright and permission notice go with every copy, and the minified bundle drops it (Security R-1, 4 Nov).
 * thirdPartyNotices.test.ts fails if a package's version or licence text here stops matching what is installed.
 */
export interface ThirdPartyNotice {
  name: string;
  version: string;
  url: string;
  use: string;
  license: string;
}

export const THIRD_PARTY_NOTICES: readonly ThirdPartyNotice[] = [
  {
    name: "glisse",
    version: "0.5.0",
    url: "https://github.com/0kzh/glisse",
    use: "The glass surfaces on unvibe.site.",
    license: `MIT License

Copyright (c) 2026 Kelvin Zhang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  },
];
