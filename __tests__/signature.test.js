const _ = require('lodash');
const signature = require('../index');
const per = require('@harmon.ie/email-util/per');


const testData = require('./data/sigdata.json');

function testSignature(title, text, from, expected) {
  const ret = signature.getSignature(text, from);
  if (expected.length === 0 && ret.signature !== '') {
    throw new Error(`Expected no signature, actual:${ret.signature}`);
  }
  if (_.isArray(expected)) {
    for (const sigTerm of expected) {
      if (ret.signature.indexOf(sigTerm) === -1) {
        throw new Error(`Failure in array:\n **Expected**: ${sigTerm}\n\n**Actual**:${ret.signature}`);
      }
    }
  } else {
    if (ret.signature !== expected) {
      throw new Error(`Failure in signature:\n **Expected**:\n${expected}\n\n**Actual**:\n${ret.signature}`);
    }
    if (text.slice(ret.characterOffsetBegin, ret.characterOffsetEnd) !== expected) {
      throw new Error(`Failure in characterOffsetBegin:\n**Expected**:\n${expected}\n\n**Actual**:\n${text.slice(ret.characterOffsetBegin)}`);
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
        const joinedExpected = tcData.expected;
        testSignature(title, tcData.body, tcData.from, joinedExpected);
      });
    }
  }
});


describe('test isUrl', () => {
  const urlData = [
    { "text": "www.lala.com", expected: true },
    { "text": "https://global.gotomeeting.com/join/511508838 <https://global.gotomeeting.com/join/511508838>", expected: true },
    { "text": "First GoToMeeting? Try a test session: https://care.lalaonline.com/g2m/getready\n", expected: true },
    { "text": "Hi. Please check that this link: https://hon.iell/RSodhhjemo/download provides you with the package you need.", expected: true },
    { "text": "//fileservOfficialReleases//har", expected: false },
    { "text": "Edit Your Email Settings<https://mjkhkjlkom/track/click/10342275/www.cl.com?p=eyJzIjoiRG1jV3lXdVZZZXdwNjhjY2k0cXFIcWZzQk5zIiwidiI6MSwicCI6IntcInVcIjoxMDM0MjI3NSxcInZcIjoxLFwidXJsXCI6XCJodHRwczpcXFwvXFxcL3d3dy5jb2Rlc2Nob29sLmNvbVxcXC9hY2NvdW50XFxcL2VkaXRcIixcImlkXCI6XCI4MTNjNTRlMjVmYWU0MzQwODg1NTU0MWNhZGY3NmRkZVwiLFwidXJsX2lkc1wiOltcImU4MWJmMTUzYjUzYWIwZWM1YTRlNzVmNGE4MGQxMTFhY2FlNTFjNGJcIl19In0>", "expected": true },
    { "text": "Harmonie 10 script 10_4.docx<https://harmoe.sharepoint.com/Mjkjjk/Shared%20Documents/Videos/Harmonie%2010%20script%20%2010_4.docx>", expected: true },
    { "text": "HKEY_CURRENT_USE\\Software\\Ma\\Prefs\\CollageEmbedUrl", expected: false },

    { "text": "https: /  / global.gotomeeting.com / join / 511508838 <https: / / global.gotomeeting.com / join / 511508838>", expected: true },
    { "text": "First GoToMeeting? Try a test session: https: /  / care.lalaonline.com / g2m / getready\n", expected: true },
    { "text": "Hi. Please check that this link: https: /  / hon.iell / RSodhhjemo / download provides you with the package you need.", expected: true },
    { "text": " / / fileservOfficialReleases / / har", expected: false },
    { "text": "http: /  / cnn.com / aa / har", expected: true },
    { "text": "Dave /  John", expected: false },

    { "text": "Edit Your Email Settings<https: /  / mjkhkjlkom / track / click / 10342275 /www.cl.com?p=eyJzIjoiRG1jV3lXdVZZZXdwNjhjY2k0cXFIcWZzQk5zIiwidiI6MSwicCI6IntcInVcIjoxMDM0MjI3NSxcInZcIjoxLFwidXJsXCI6XCJodHRwczpcXFwvXFxcL3d3dy5jb2Rlc2Nob29sLmNvbVxcXC9hY2NvdW50XFxcL2VkaXRcIixcImlkXCI6XCI4MTNjNTRlMjVmYWU0MzQwODg1NTU0MWNhZGY3NmRkZVwiLFwidXJsX2lkc1wiOltcImU4MWJmMTUzYjUzYWIwZWM1YTRlNzVmNGE4MGQxMTFhY2FlNTFjNGJcIl19In0>", "expected": true },
    { "text": "Harmonie 10 script 10_4.docx<https: /  / harmoe.sharepoint.com / Mjkjjk / Shared%20Documents / Videos / Harmonie%2010%20script%20%2010_4.docx>", expected: true },
    { "text": "HKEY_CURRENT_USE\\Software\\Ma\\Prefs\\CollageEmbedUrl", expected: false },

  ];
  for (const a of urlData) {
    it(`test ${a.text}`, () => {
      const isUrl = signature.isUrl(a.text);
      expect(isUrl).toEqual(a.expected);
    });
  }
});

describe('test maybeEmail', () => {
  const emailData = [
    { "text": "David Lda<mailto:davidl@lala.ie>", "expected": true },
    { "text": "stay@home with sick child", "expected": false },
    { "text": "[Luis]: Are you able to see the collections being created after this initialization period? How long does it usually take? @Jj Mondal @wini have you tried this?", "expected": false },
  ];
  for (const a of emailData) {
    it(`test ${a.text}`, () => {
      const isEmail = signature.maybeEmail(a.text);
      expect(isEmail).toEqual(a.expected);
    });
  }
});

describe('test isSentFromMy', () => {
  const sentFromData = [
    { "text": "sent from my iPhone", "expected": true },
    { "text": "sen from my iPhone", "expected": false },
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
    { "testName": "simple", "line": "David", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, "requireCloseStart": true, expected: 1 },
    { "testName": "non capitalized", "line": "david", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, "requireCloseStart": true, expected: 0.5 },
    { "testName": "spaces", "line": "a         David              bb", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, "requireCloseStart": true, expected: 1 },
    { "testName": "special chars - email", "line": "thanks, O'hara", "from": { "displayName": "test", "mail": "o'hara@jaja.com" }, "requireCloseStart": true, expected: 1 },
    { "testName": "special chars - displayName", "line": "thanks, O'hara", "from": { "displayName": "User O'hara", "mail": "test@jaja.com" }, "requireCloseStart": true, expected: 1 },
    { "testName": "similar", "line": "Thanks, Davis", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, "requireCloseStart": true, expected: 0 },
    { "testName": "not close to start", "line": "123451234512345 David", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, "requireCloseStart": true, expected: 0 },
    { "testName": "not close to start - false", "line": "123451234512345 David", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, "requireCloseStart": false, expected: 1 },
    { "testName": "assignmet", "line": "kjhkljlddddddddddddddddd - David", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, "requireCloseStart": false, expected: 1 },
    { "testName": "partial match", "line": "* Stan Bee & Lee told us", "from": { "displayName": "David St. George", "mail": "davids@lala.com" }, "requireCloseStart": true, expected: 0 },
    { "testName": "partial token match", "line": "* St and Bee & Lee told us", "from": { "displayName": "David St. George", "mail": "davids@lala.com" }, "requireCloseStart": true, expected: 0 },
    { "testName": "not nearby match", "line": "* David and also St Lee told us", "from": { "displayName": "David St. George", "mail": "davids@lala.com" }, "requireCloseStart": true, expected: 0 },
    { "testName": "nearby match", "line": "* David a St Lee told us", "from": { "displayName": "David St. George", "mail": "davids@lala.com" }, "requireCloseStart": true, expected: 1 },

    //{"testName":"different display name", "line": "David Long", "from": {"displayName": "Test Support", "mail":"davidl@jaja.com"}, "requireCloseStart":true, expected:1 },

  ];

  for (const a of senderScoreDate) {
    let { arrNameTok } = per.parseMailTokens(a.from);
    it(`test ${a.testName}`, () => {
      expect(signature.getSenderScore(a.line, arrNameTok, a.requireCloseStart)).toEqual(a.expected);
    });
  }

});

describe('test maybeStartSig', () => {
  const startSigData = [
    { "testName": "simple", "line": "David", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expected: true },
    { "testName": "thanks not close to start", "line": "12345 Thanks, ", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expected: false },
    { "testName": "not close to end", "line": "thanks a lot for your time and ", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expected: false },
    { "testName": "close to end", "line": "thanks for your time", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expected: true },
    { "testName": "Best", "line": "best wishes,", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expected: true },
    { "testName": "double space", "line": "Yours  Truly,", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expected: true },
    { "testName": "+Best", "line": "all the best,", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expected: true },
    { "testName": "email line", "line": "David Long<mailto:davidl@lala.ie>", "from": { "displayName": "David Long", "mail": "davidl@lala.ie" }, expected: false },
    { "testName": "sent from my line", "line": "Sent from my iPhone", "from": { "displayName": "David Long", "mail": "davidl@lala.ie" }, expected: true },


  ];

  for (const a of startSigData) {
    let { arrNameTok } = per.parseMailTokens(a.from);
    it(`test ${a.testName}`, () => {
      expect(signature.maybeStartSig(a.line, arrNameTok, 1).found).toEqual(a.expected);
    });
  }
});

describe('test isListLine', () => {
  const listLineData = [
    { "text": "sent from my iPhone", "expected": false },
    { "text": "John A | CEO", "expected": true },
    { "text": "John A|CEO", "expected": true },
    { "text": "| 210 Northern Avenue Suite 400 |", "expected": true },
    { "text": "John A:CEO", "expected": false },
    { "text": "John A, CEO", "expected": false },

  ];

  for (const a of listLineData) {
    it(`test ${a.text}`, () => {
      expect(signature.isListLine(a.text)).toEqual(a.expected);
    });
  }

});

describe('test isLongLine', () => {
  const longLineData = [
    { "text": "sent from my iPhone", "expected": false },
    { "text": "John A | CEO", "expected": false },
    { "text": "test test test test test", "expected": false },
    { "text": "test test test test test test", "expected": true },
    { "text": "210 Northern Avenue, Suite 400", "expected": false },

  ];

  for (const a of longLineData) {
    it(`test ${a.text}`, () => {
      expect(signature.isLongLine(a.text)).toEqual(a.expected);
    });
  }

});

describe('test isEmbeddedImage', () => {
  const EmbeddedImageData = [
    { "text": "Skype id", "expected": false },
    { "text": "[cid:_1_85F64GG5F64248004D793185258211].", "expected": true },
    { "text": "[cid:jD9V0h2pRGGG1JF-XpdgEW_BQugEFDHaGKzrAy9q-aw=]<http://indicative.com>", "expected": true },
    { "text": "[cid:2__=8FBBGGGDF87C7AD8f9e8a93df938690918c8FB@]", "expected": true },
    { "text": "  *   [cid:1511GG246432]", "expected": true },
    { "text": "https://test-my.sharepoint.com/personal/ie/_layouts/15/guestaccess.aspx?guestaccesstoken=hhhkgBLepKYkPNBdH5kK06Dnu93fw%3d&docid=2_19adbf0164817432b8ef07771b725ea74&rev=1&", "expected": false },

  ];

  for (const a of EmbeddedImageData) {
    it(`test ${a.text}`, () => {
      expect(signature.isEmbeddedImage(a.text)).toEqual(a.expected);
    });
  }

});

describe('test isInternetService', () => {
  const InternetServiceData = [
    { "text": "Skype ID: daaaaaaa.aaa", "expected": true },
    { "text": "[cid:_1_85F64GG5F64248004D793185258211].", "expected": false },
    { "text": "Connect With Me: LinkedIn", "expected": true },
    { "text": "Skype: Cj.adllltive", "expected": true },
    { "text": "  *   Skype ID: aaa", "expected": true },
    { "text": "P: 444-401-7148 • F: 444-864-3947 • Skype: aaa.aaa", "expected": true },


  ];

  for (const a of InternetServiceData) {
    it(`test ${a.text}`, () => {
      expect(signature.isInternetService(a.text)).toEqual(a.expected);
    });
  }

});

describe('test getSignatureScore', () => {
  const sigScoreData = [
    { "testName": "email rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n lala@lala.com\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },
    { "testName": "phone rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n 123 - 456 - 789 - 111\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },
    { "testName": "url rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n http://test.com \r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },
    { "testName": "internet service rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n Linkedin: \r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },
    { "testName": "sent from my rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n Sent From my iPhone\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },
    { "testName": "short line rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n test\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 0.25 }, { "testName": "short line rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n Sent From my iPhone\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },
    { "testName": "list line rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n la | la | la\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 0.75 },
    { "testName": " capitalized sender rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n David\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },
    { "testName": "non capitalized sender rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n david\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },
    { "testName": "long line rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n this is a longg line with a lot af words about a lot of things.\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: -0.75 },
    { "testName": "sig + long line rank", "idxStartSig": 1, "idxEndSig": 6, "body": "lalala\r\nthanks\r\n  123 - 456 - 789 - 111 \r\n lala@lala.com\r\n David\r\ntest longg line at the end to remove score lala la la la la la la la \r\n", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 2.5 },
    { "testName": "email and sender rank", "idxStartSig": 1, "idxEndSig": 4, "body": "lalala\r\nthanks\r\n lala@lala.com\r\nDavid\r\n", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 2 },
    { "testName": "image rank", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n [cid:jD9V0h2pGGGU1JF-XpdgEW_BQugEFDHaGKzrAy9q-aw=]\r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 0.5 },
    { "testName": "internet service", "idxStartSig": 1, "idxEndSig": 3, "body": "lalala\r\nthanks\r\n Skype ID: lala.lalala \r\nlalala", "from": { "displayName": "David Long", "mail": "davidl@jaja.com" }, expectedScore: 1 },

  ];

  for (const a of sigScoreData) {
    let { arrNameTok } = per.parseMailTokens(a.from);
    let lines = (a.body).match(/[^\r\n]+/g);
    it(`test ${a.testName}`, () => {
      expect(signature.getSignatureScore(a.idxStartSig, a.idxEndSig, lines, arrNameTok).score).toEqual(a.expectedScore)
    });
  }
});

describe('test api', () => {
  it(`test removeSignature when signature is detected`, () => {
    const body = `Hi Text\nThanks,\nDekel`;
    const from = { displayName: 'Dekel Cohen', email: 'dekel@somemail.net' }
    expect(signature.removeSignature(body, from)).toEqual('Hi Text');
  });

  it(`test removeSignature when signature is not detected`, () => {
    const body = `Hi Text\nThanks`;
    const from = { displayName: 'Dekel Cohen', email: 'dekel@somemail.net' }
    expect(signature.removeSignature(body, from)).toEqual(body);
  });
});







