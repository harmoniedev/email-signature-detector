const _ = require('lodash');
const signature = require('email-signature-detector');
const per = require('email-util/per');


const testData = require('./data/sigdata.json');

function testSignature(text,from,expected) {
    const ret = signature.getSignature(text,from);
    if (expected.length === 0 && ret.signature !== '') {
        throw new Error(`Expected no signature, actual:${ret.signature}`);
    }
    if (_.isArray(expected)) {
        for (const sigTerm of expected) {
            if (ret.signature.indexOf(sigTerm) === -1) {
                throw new Error(`**Expected**: ${sigTerm}\n\n**Actual**:${ret.signature}`);
            }
        }
    } else {
        if (ret.signature !== expected) {
            throw new Error(`**Expected**: ${expected}\n\n**Actual**:${ret.signature}`);
        }
    }

}



describe('test Signature detector', () => {
    for (const tcData of testData) {
        const title = `test ${tcData.testName}`;
        if (tcData.skip) {
            it.skip(title, () => {
            });
        } else {
            it(title, () => {
                const joinedExpected = _.isEmpty(tcData.expected) ? tcData.expected : tcData.expected.match(/[^\r\n]+/g).join('\r\n');
                testSignature(tcData.body,tcData.from,joinedExpected);
            });
        }
    }

});


describe('test isUrl', () => {
    const urlData = [
        {"text":"www.lala.com", expected: true},
        {"text":"https://global.gotomeeting.com/join/511508838 <https://global.gotomeeting.com/join/511508838>", expected: true},
        {"text":"First GoToMeeting? Try a test session: https://care.lalaonline.com/g2m/getready\n", expected: true},
        {"text":"Hi. Please check that this link: https://hon.iell/RSodhhjemo/download provides you with the package you need.", expected: true},
        {"text":"//fileservOfficialReleases//har", expected: false},
        {"text":"Edit Your Email Settings<https://mjkhkjlkom/track/click/10342275/www.cl.com?p=eyJzIjoiRG1jV3lXdVZZZXdwNjhjY2k0cXFIcWZzQk5zIiwidiI6MSwicCI6IntcInVcIjoxMDM0MjI3NSxcInZcIjoxLFwidXJsXCI6XCJodHRwczpcXFwvXFxcL3d3dy5jb2Rlc2Nob29sLmNvbVxcXC9hY2NvdW50XFxcL2VkaXRcIixcImlkXCI6XCI4MTNjNTRlMjVmYWU0MzQwODg1NTU0MWNhZGY3NmRkZVwiLFwidXJsX2lkc1wiOltcImU4MWJmMTUzYjUzYWIwZWM1YTRlNzVmNGE4MGQxMTFhY2FlNTFjNGJcIl19In0>", "expected": true},
        {"text":"Harmonie 10 script 10_4.docx<https://harmoe.sharepoint.com/Mjkjjk/Shared%20Documents/Videos/Harmonie%2010%20script%20%2010_4.docx>", expected: true},
        {"text":"HKEY_CURRENT_USE\\Software\\Ma\\Prefs\\CollageEmbedUrl", expected: false},

    ];
    for (const a of urlData) {
        it(`test ${a.text}`, () => {
            const isUrl = signature.isUrl(a.text);
            expect(isUrl).toEqual(a.expected);
        });
    }
});

describe('test maybeEmail', ()=>{
    const emailData = [
        {"text":"David Lda<mailto:davidl@lala.ie>", "expected": true},
        //{"text":"stay@home with sick child", "expected": false},
        {"text":"[Luis]: Are you able to see the collections being created after this initialization period? How long does it usually take? @Jj Mondal @wini have you tried this?", "expected": false},
    ];
    for (const a of emailData) {
        it(`test ${a.text}`, () => {
            const isEmail = signature.maybeEmail(a.text);
              expect(isEmail).toEqual(a.expected);
        });
    }
});

describe('test isSentFromMy', ()=> {
    const sentFromData = [
        {"text":"sent from my iPhone", "expected": true},
        {"text":"sen from my iPhone", "expected": false},
    ];

    for (const a of sentFromData) {
        it(`test ${a.text}`, () => {
            const isSentFromMy = signature.isSentFromMy(a.text);
            expect(isSentFromMy).toEqual(a.expected);
        });
    }
});


describe('test senderScore', () => {
    const senderScoreDate = [
        {"testName":"simple", "line": "David", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, "requireCloseStart":true, expected:1 },
        {"testName":"non capitalized", "line": "david", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, "requireCloseStart":true, expected:0.5 },
        {"testName":"spaces", "line": "a         David              bb", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, "requireCloseStart":true, expected:1 },
        //{"testName":"different display name", "line": "David Long", "from": {"displayName": "Test Support", "mail":"davidl@jaja.com"}, "requireCloseStart":true, expected:1 },
        {"testName":"special chars - email", "line": "thanks, O'hara", "from": {"displayName": "test", "mail":"o'hara@jaja.com"}, "requireCloseStart":true, expected:1 },
        {"testName":"special chars - displayName", "line": "thanks, O'hara", "from": {"displayName": "User O'hara", "mail":"test@jaja.com"}, "requireCloseStart":true, expected:1 },
        {"testName":"similar", "line": "Thanks, Davis", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, "requireCloseStart":true, expected:0 },
        {"testName":"not close to start", "line": "123451234512345 David", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, "requireCloseStart":true, expected:0 },
        {"testName":"not close to start", "line": "123451234512345 David", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, "requireCloseStart":false, expected:1 },
        {"testName":"assignmet", "line": "kjhkljlddddddddddddddddd - David", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, "requireCloseStart":false, expected:1 },



    ];

    for (const a of senderScoreDate) {
        let { arrNameTok } = per.parseMailTokens( a.from );
        it(`test ${a.testName}`, () => {
            expect(signature.getSenderScore(a.line, arrNameTok, a.requireCloseStart)).toEqual(a.expected);
        });
    }

});

describe('test maybeStartSig', () => {
    const startSigData = [
         {"testName":"simple", "line": "David", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, expected: true },
         {"testName":"not close to stars", "line": "123456789012345 David 1234567890123456", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, expected: false },
         {"testName":"not close to stars- false", "line": "123456789012345 David", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, expected: true },
         {"testName":"+Best", "line": "best wishes,", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, expected: true },

        //as designed but can be fixed:
         {"testName":"double space", "line": "Yours  Truly,", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, expected: true },
         {"testName":"+Best", "line": "all the best,", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, expected: true },

    ];

    for (const a of startSigData) {
        let { arrNameTok } = per.parseMailTokens( a.from );
        it(`test ${a.testName}`, () => {
            expect(signature.maybeStartSig(a.line, arrNameTok)).toEqual(a.expected);
        });
    }
});

describe('test isListLine', () => {
    const listLineData = [
        {"text":"sent from my iPhone", "expected": false},
        {"text":"John A | CEO", "expected": true},
        {"text":"John A|CEO", "expected": true},
        {"text":"| 210 Northern Avenue Suite 400 |", "expected": true}

    ];

    for (const a of listLineData) {
        it(`test ${a.text}`, () => {
            expect(signature.isListLine(a.text)).toEqual(a.expected);
        });
    }

});

describe('test getSignatureScore', () => {
    const sigScoreData = [
        {"testName":"simple", "idxStartSig":0, "idxEndSig":1, "lines": "David", "from": {"displayName": "David Long", "mail":"davidl@jaja.com"}, expectedScore: 1}

    ];

    for(const a of sigScoreData) {
        let { arrNameTok } = per.parseMailTokens( a.from );

        it(`test ${a.testName}`, () => {
            expecte(signature.getSignatureScore(a.idxStartSig, a.idxEndSig, a.lines, arrNameTok)).toEqual(a.expectedScore)
        });
    }
});






