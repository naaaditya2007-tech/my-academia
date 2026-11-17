import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { parseAttendanceAndMarksHtml, decodeZohoHtml } from '../src/lib/scraper';

console.log('--- Starting Offline Attendance Parser Unit Tests ---');

// Test Case 1: Standard SRM table with S.No at Column 0 and Course Code at Column 1
const htmlStandardTable = `
<html>
<body>
  <table>
    <tr>
      <th>S.No</th>
      <th>Course Code</th>
      <th>Course Title</th>
      <th>Category</th>
      <th>Faculty</th>
      <th>Slot</th>
      <th>Room</th>
      <th>Conducted</th>
      <th>Absent</th>
      <th>Attd %</th>
    </tr>
    <tr>
      <td>1</td>
      <td>21CSC201J</td>
      <td>Data Structures and Algorithms</td>
      <td>Integrated</td>
      <td>Dr. Rajesh Kumar</td>
      <td>A</td>
      <td>TP401</td>
      <td>45</td>
      <td>3</td>
      <td>93.33%</td>
    </tr>
    <tr>
      <td>2</td>
      <td>21MTH101T</td>
      <td>Calculus and Linear Algebra</td>
      <td>Theory</td>
      <td>Prof. Sunita Sharma</td>
      <td>B</td>
      <td>UB502</td>
      <td>40</td>
      <td>0</td>
      <td>100%</td>
    </tr>
  </table>
</body>
</html>
`;

const res1 = parseAttendanceAndMarksHtml(htmlStandardTable);
console.log(`Test 1 (Standard Table): parsed ${res1.length} courses`);
assert.strictEqual(res1.length, 2, 'Should parse 2 courses');
assert.strictEqual(res1[0].code, '21CSC201J');
assert.strictEqual(res1[0].title, 'Data Structures and Algorithms');
assert.strictEqual(res1[0].hoursConducted, 45);
assert.strictEqual(res1[0].hoursAbsent, 3);
assert.strictEqual(res1[0].hoursAttended, 42);
assert.strictEqual(res1[0].type, 'Embedded'); // endsWith('J')
assert.strictEqual(res1[1].code, '21MTH101T');
assert.strictEqual(res1[1].hoursAttended, 40);
assert.strictEqual(res1[1].attendancePercentage, 100);

// Test Case 2: Hex-escaped HTML (Zoho Creator style: \x3Ctable...)
const htmlHexEscaped = `\\x3Ctable\\x3E\\x3Ctr\\x3E\\x3Ctd\\x3E1\\x3C/td\\x3E\\x3Ctd\\x3E21EES101T\\x3C/td\\x3E\\x3Ctd\\x3EElectrical Sciences\\x3C/td\\x3E\\x3Ctd\\x3ETheory\\x3C/td\\x3E\\x3Ctd\\x3EDr. Raman\\x3C/td\\x3E\\x3Ctd\\x3EC\\x3C/td\\x3E\\x3Ctd\\x3E30\\x3C/td\\x3E\\x3Ctd\\x3E2\\x3C/td\\x3E\\x3C/tr\\x3E\\x3C/table\\x3E`;
const res2 = parseAttendanceAndMarksHtml(htmlHexEscaped);
console.log(`Test 2 (Hex-Escaped HTML): parsed ${res2.length} courses`);
assert.strictEqual(res2.length, 1, 'Should parse 1 course from hex escaped HTML');
assert.strictEqual(res2[0].code, '21EES101T');
assert.strictEqual(res2[0].hoursConducted, 30);
assert.strictEqual(res2[0].hoursAbsent, 2);

// Test Case 3: Unicode-escaped HTML (Zoho Creator JSON style: \u003Ctable...)
const htmlUnicodeEscaped = `\\u003Ctable\\u003E\\u003Ctr\\u003E\\u003Ctd\\x3E1\\u003C/td\\u003E\\u003Ctd\\u003E18CSC101\\u003C/td\\u003E\\u003Ctd\\u003EProgramming in C\\u003C/td\\u003E\\u003Ctd\\u003ED\\u003C/td\\u003E\\u003Ctd\\u003E50\\u003C/td\\u003E\\u003Ctd\\u003E5\\u003C/td\\u003E\\u003C/tr\\u003E\\u003C/table\\u003E`;
const res3 = parseAttendanceAndMarksHtml(htmlUnicodeEscaped);
console.log(`Test 3 (Unicode-Escaped HTML): parsed ${res3.length} courses`);
assert.strictEqual(res3.length, 1, 'Should parse 1 course from unicode escaped HTML');
assert.strictEqual(res3[0].code, '18CSC101');
assert.strictEqual(res3[0].hoursConducted, 50);
assert.strictEqual(res3[0].hoursAbsent, 5);

// Test Case 4: HTML Entities (&lt;table...)
const htmlEntities = `&lt;table&gt;&lt;tr&gt;&lt;td&gt;1&lt;/td&gt;&lt;td&gt;21CSE301T&lt;/td&gt;&lt;td&gt;Operating Systems&lt;/td&gt;&lt;td&gt;F&lt;/td&gt;&lt;td&gt;36&lt;/td&gt;&lt;td&gt;0&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;`;
const res4 = parseAttendanceAndMarksHtml(htmlEntities);
console.log(`Test 4 (HTML Entities): parsed ${res4.length} courses`);
assert.strictEqual(res4.length, 1, 'Should parse 1 course from HTML entities');
assert.strictEqual(res4[0].code, '21CSE301T');

// Test Case 5: Table inside <script> tag
const htmlInScript = `
<html>
<head><title>Zoho Creator</title></head>
<body>
  <div id="container"></div>
  <script>
    var content = "<table class='zc-view-table'><tr><td>1</td><td>21CYB101T</td><td>Cyber Security Essentials</td><td>E</td><td>28</td><td>1</td></tr></table>";
  </script>
</body>
</html>
`;
const res5 = parseAttendanceAndMarksHtml(htmlInScript);
console.log(`Test 5 (Table in <script>): parsed ${res5.length} courses`);
assert.strictEqual(res5.length, 1, 'Should parse 1 course embedded inside <script>');
assert.strictEqual(res5[0].code, '21CYB101T');

// Test Case 6: Missing columns (e.g. only course code, title, and conducted hours)
const htmlMinimal = `
<table>
  <tr>
    <td>21LEM101T</td>
    <td>Constitution of India</td>
    <td>20</td>
  </tr>
</table>
`;
const res6 = parseAttendanceAndMarksHtml(htmlMinimal);
console.log(`Test 6 (Minimal Columns): parsed ${res6.length} courses`);
assert.strictEqual(res6.length, 1, 'Should be tolerant of missing columns');
assert.strictEqual(res6[0].code, '21LEM101T');
assert.strictEqual(res6[0].hoursConducted, 20);
assert.strictEqual(res6[0].faculty, 'Faculty TBA');
assert.strictEqual(res6[0].room, 'Venue TBA');

console.log('--- ALL 6 OFFLINE ATTENDANCE PARSER TESTS PASSED! ---');
