const signature = require('email-signature-detector');

const phoneTestData = [
	{ line: 'phone + 49 30 3080 8556', expected: true },
	{ line: '+353 91 514 502', expected: true },
	{ line: '(Office) 0203 805 7791', expected: true },
	{ line: '617-986-5038', expected: true },
	{ line: '+972-3-6005472', expected: true },
	{ line: '+1 (647) 497-9353', expected: true },
	{ line: '+49 692 5736 7211', expected: true },
	{ line: '+44 330 221 0088', expected: true },
	{ line: '+1-845-913-7240<tel:1-845-913-7240>', expected: true },
	{ line: '(089) / 636-48018', expected: true },
	{ line: '19-49-89-636-48018', expected: true },
	{ line: '+49-89-636-48018', expected: true },
	{ line: '6641234567', expected: true },
	{ line: 'm: *308', expected: true },
	{ line: '301.587.8202 | 800.477.2446', expected: true },

	{ line: 'Office: +1 (310) 774-0014', expected: true },
	{ line: 'DEPARTURE: NEW YORK, NY (JOHN F KENNEDY INTL), TERMINAL 4        24 MAY 10:30', expected: false },	
	{ line: 'JFK – Chicago Jet Blue 8:20AM', expected: false },		
	{ line: '2049 Century Park East, Suite 2550', expected: false },	
	{ line: 'Apt 3080, North Blvd.', expected: false },	
	{ line: '49-89--636     48018', expected: false },
    { line: 'Italy: +39 0 230 57 81 42', expected: true },
    { line: 'When: Sep 24, 2017 10:30:00 AM', expected: false },
    { line: 'When: 24-09-17', expected: false, only: true },
    { line: '030 3080 8556 (fax)', expected: true },
    { line: '312-57777793', expected: true },


	//Skipped - failing tests: Since we are interested in phones only for signature scoring purposes, it doesn't matter if we confuse them with email like (@) or url like 
//	{ line: '[cid:image001.jpg@01CEA712.15640750][cid:image002.jpg@01CEA712.15640750]<https://twitter.com/dlavenda>', expected: false },	
//	{ line: 'https://www.finnegan.com/images/content/1/7/v2/177193/GDPR-Mailing-Image-April.jpg', expected: false },	

	
];

/* 

*/
describe.only('test Phone number extractor', () => {
	let executedTestsData = phoneTestData.filter((tcData)=>tcData.only);
	if (executedTestsData.length === 0) {
	    executedTestsData = phoneTestData;
	}
	for (const tcData of executedTestsData) {
	    it(`test ${tcData.line}`, () => {
	    	//debugger;
	
	        const isPhone = signature.maybePhone(tcData.line);
	        expect(isPhone).toEqual(tcData.expected);
	     });
    }
});