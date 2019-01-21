const _ = require('lodash');
const per = require('@harmon.ie/email-util/per');
const phone = require('@harmon.ie/email-util/phone');
const marketing = require('@harmon.ie/email-util/marketing');

function splitLine(line) {
  const re = /\s/;
  return line.split(re);
}

const MAX_SIG_NUM_LINES = 18;

function maybeEmail(str) {
  const re = /\S{1,30}@\S{1,30}\.\S{1,30}/;
  return re.test(String(str).toLowerCase());
}


function maybePhone(str) {
  const re = /(phone:|tel:|mobile:|(^|\s+)cell:|office:|direct:|(^|\s+)o:|fax:|(^|\s+)m:).*?\d{2,}/;
  return re.test(String(str).toLowerCase()) || phone.extractPhoneNumbers(str).length > 0;
}

function isUrl(str) {
  const re = /http[s]*:\/\/|www\..+\.|web:|website:/;
  return re.test(String(str).toLowerCase());
}

function isInternetService(str) {
  const re = /skype:|skype\s{0,5}id:|\(skype\)|twitter|facebook|linkedin|blog/;
  return re.test(String(str).toLowerCase());
}

function isEmbeddedImage(str) {
  const re = /\[cid:/;
  return re.test(String(str).toLowerCase());
}

const reSentFromMy = /\s{0,5}sent from my/;
const reGetOutlook = /\s{0,5}get outlook for/;

function isSentFromMy(str) {
  return reSentFromMy.test(String(str).toLowerCase());
}


function isShortLine(line) {
  return splitLine(line).length <= 4;
}

function isLongLine(line) {
  return splitLine(line).length > 5;
}

function numWords(line) {
  return splitLine(line).filter((tok) => tok.length > 1 && tok.match(/[a-zA-Z]/) != null).length;
}

function mayBeUnsubscribe(line) {
  const words = marketing.getInitSpecialBodyWords();
  marketing.getSpecialBodyWords(line, words);
  const re = /opt{0,2}out/;
  return words.unsubscribe > 0 || words.noWishReceive > 0 || re.test(String(line).toLowerCase());

}

//Ex: Joe Benjamin | Founder & CEO | youngStartup
function isListLine(line) {
  const re = /\|/;
  return line.split(re).length >= 2;
}

// Input: line - a line of email (not trimmed, not lowercased)
// Return score indicating prob of sender name (Ram, Ron Johnsen) occuring in line.
// 0 - not a sender name
// 0.5 - propbably a sender name
// 1 - definetly a sender name
// TODO: Rank much higher > 1 word match
// TODO: Allow case-insensitive matches (---yehonathan), but rank higher capitalized matches (Yehonathan)
function getSenderScore(line, arrSenderTok, requireCloseStart) {
  const maxDistFromStartLine = 15;
  let minSenderIdx = 100000;
  let maxSenderIdx = -1; //max pos in line where a sender token is matched + token.length
  let nMatchToks = 0;    //Number of matches of tokens
  let nMatchCapToks = 0; //Number of matches where token is capitalized in text
  let score = 0;
  line = line.trim();
  const normLine = String(line).toLowerCase();
  let totalLenMatchingToks = 0;
  for (const tok of (arrSenderTok || [])) {
    const wholeWordTokPat = '\\b' + tok + '\\b';
    const m = new RegExp(wholeWordTokPat).exec(normLine);
    if (m != null) {
      const idx = m.index;
      nMatchToks += 1;
      totalLenMatchingToks += tok.length;
      if (idx < minSenderIdx) {
        minSenderIdx = idx;
      }
      if (idx > maxSenderIdx) {
        maxSenderIdx = idx + tok.length;
      }
      if (line[idx] === line[idx].toLocaleUpperCase() &&       //Uppercase match - in original line string
        normLine[idx] !== normLine[idx].toLocaleUpperCase()) { //Heb, CHS don't have upper case anyway.
        nMatchCapToks += 1;
      }
    } //End if m != null

  } //End for tok

  if (nMatchToks === 0) {
    score = 0;
  } else if (totalLenMatchingToks <= 2) { //* Require matching more than 2 characters (avoid David E. Cohen - match 'E' or Zacharay St. George - Match 'St')
    score = 0;
  } else if (requireCloseStart && (minSenderIdx > maxDistFromStartLine) || numWords(line) >= 10) { //* Require name to be close to start of the line (avoid long lines that are part of email body that mentions sender name)
    //console.log(`non sender: long/far from start: ${line}`);
    score = 0;
  } else if ((maxSenderIdx - minSenderIdx) / totalLenMatchingToks > 2) { //* Require matching sender tokens to be nearby (but not adjacent)
    score = 0;
  } else if (nMatchCapToks === 0 && nMatchToks === 1) { //Only a single non-Capitalized match.
    score = 0.5;
  } else if (nMatchCapToks > 0 || nMatchToks > 1) {
    score = 1;
  }

  return score;
}
//* Is the line containing pattern of startSig, which is also close to the start and end of line (5 chars)
function maybeStartSig(line, arrSenderTok, idxLine) {
  let startSig = false;
  const distFromStartLine = 5;
  let distFromEndLine = 15;
  const normline = String(line).toLowerCase().trim();
  let lastLineSig = false;
  let m = normline.match(reSentFromMy);
  //Sent from my Samsung Galaxy smartphone.
  if (m && m.length > 0) {
    if (m.index <= distFromStartLine && normline.length - (m.index + m[0].length) < 40/*distFromEndLine*/) {
      startSig = lastLineSig = true;
    }
  }
  //Get Outlook for iOS<https://aka.ms/o0ukef>
  m = normline.match(reGetOutlook);
  if (m && m.length > 0) {
    if (m.index <= distFromStartLine && normline.length - (m.index + m[0].length) < 40/*distFromEndLine*/) {
      startSig = lastLineSig = true;
    }
  }
  //For most triggers, do not allow the first line in email - this is to avoid large noise from Emails that starts with Thanks ...  or Start with sender Name


  if (idxLine > 0) {
    //Thanks,
    if (!startSig) {
      const re = /thank.{1,30}regards|thank {0,3}you|thanx|thanks|many {0,3}thanks|regard|sincerely|all {0,3}the {0,3}best|best|with {0,3}appreciation|with {0,3}gratitude|yours {0,3}truly|cheers|faithfully|^[\s]*---*[\s]*$|^[\s]*___*[\s]*$/;
      m = normline.match(re);
      if (m && m.length > 0) {
        if (m.index <= distFromStartLine && normline.length - (m.index + m[0].length) < distFromEndLine) {
          startSig = true;
        }
      }
    }
    //David Cohen,
    if (!startSig) {
      startSig = lastLineSig = !maybeEmail(line) && getSenderScore(line, arrSenderTok, true) >= 1;
    }
  }
  return { found: startSig, props: { lastLineSig } };
}

const SCORE_SIG_LINE = 1;
const SCORE_EMBEDDED = 0.5;
const SCORE_URL_LONG_LINE = 0.25;
const SCORE_SHORT_LIST_LINE = 0.25;
const SCORE_LONG_LINE_LOW = -0.5;
const SCORE_LONG_LINE_HIGH = -0.75;

function getSignatureScore(idxStartSig, idxEndSig, lines, arrSenderTok, startSig) {
  let score = 0;
  let lni = '';
  for (let i = idxStartSig + 1; i < idxEndSig; ++i) {
    const origLine = lines[i];
    const iterLines = isListLine(origLine) ? origLine.split('|') : [origLine];
    for (const line of iterLines) {
      if (maybeEmail(line) || maybePhone(line) || isInternetService(line) || isSentFromMy(line)) {
        lni += (`>> +${SCORE_SIG_LINE} line=${line}\n`);
        score += SCORE_SIG_LINE;
      } else if (getSenderScore(line, arrSenderTok, true) > 0) {
        lni += (`>> sender +${SCORE_SIG_LINE} line=${line}\n`);
        score += SCORE_SIG_LINE;
      } else if (isUrl(line)) {
        const numWords = splitLine(line).length;
        //Score urls less as they appear in a longer line (probably not a signature, but a regular email line)

        const urlScore = numWords < 15 || isListLine(line) || mayBeUnsubscribe(line) ? SCORE_SIG_LINE : SCORE_URL_LONG_LINE;
        lni += (`>> url ${urlScore} line=${line}\n`);
        score += urlScore;
      } else if (isEmbeddedImage(line)) {
        lni += (`>> cid +${SCORE_EMBEDDED} line=${line}\n`);
        score += SCORE_EMBEDDED;
      } else if (isShortLine(line)) {
        lni += (`>> short +${SCORE_SHORT_LIST_LINE} line=${line}\n`);
        score += SCORE_SHORT_LIST_LINE;
      } else if (isLongLine(line) && !mayBeUnsubscribe(line)) {
        const longScore = score > 2 ? SCORE_LONG_LINE_LOW : SCORE_LONG_LINE_HIGH;
        lni += (`>> long ${longScore} line=${line}\n`);
        //If long line and didn't find any sig-hint (url, phone, list ...) --> may be a false sig start that include many text line below it --> penalize score 
        //Long-lines should penalize more if not enough evidence (score) is accumulated from idxStartSig until current long line
        //Ex: Thanks at the beginning --> short email (2-3 long lines) --> long signature (many good sig lines) without a  maybeStartSig --> may cut entire email !!!
        //If, on the other hand, there are several anti-virus/ecological/legal/marketing advertisment long lines AFTER or in a MIDDLE of a good signature (score is higher) --> penalize less
        score += longScore;
      }
    } //End iterLines loop         
  }
  return { score, dbg: { lni } };
}

function tryExtractSig({ score, dbg, idxStartSig, props }, lines, { bodyNoSig }, ret) {
  let idxStartFinalSig = -1;
  //* Require > 4 or 30% lines, after the startSig, looks like one of the above signature clues.
  if (score >= 4 ||
    (score / (lines.length - idxStartSig) >= 0.3) ||
    (props.lastLineSig && (lines.length - idxStartSig) === 1)) {
    //* Limit to delete only 16 lines from the end of the email (not after the startSig)
    idxStartFinalSig = Math.max(lines.length - MAX_SIG_NUM_LINES, idxStartSig);
    ret.signature = lines.slice(idxStartFinalSig).join('\r\n');
    ret.idxLineStartSig = idxStartSig;
    ret.found = true;
    if (bodyNoSig) {
      ret.bodyNoSig = lines.slice(0, idxStartFinalSig).join('\r\n');
    }
  } 
  ret.dbg = { ...ret.dbg, ...dbg };
}

//from.email || from.mail, from.displayName
function getSignature(body, from, bodyNoSig) {

  let ret = {
    signature: '',
    found: false,
    dbg: {},
    characterOffsetBegin: body.length,
    characterOffsetEnd: body.length
  };
  const { arrNameTok } = per.parseMailTokens(from);
  const lines = body.match(/[^\r\n]+/g);
  if (!lines) { return ret; }

  //The first line cannot be a signature. It has to start <= MAX_SIG_NUM_LINES lines from the end.
  const startLine = Math.max(lines.length - MAX_SIG_NUM_LINES, 0);
  //Collect candidates for sig, score each one.
  const candStartSig = [];
  for (let i = startLine; i < lines.length; ++i) {
    const startSig = maybeStartSig(lines[i], arrNameTok, i);
    if (startSig.found) {

      const ret = getSignatureScore(i, lines.length, lines, arrNameTok, startSig);
      //console.log(`candidate: score=${ret.score} idxStartSig=${i}  lines.length - idxStartSig=${lines.length - i}\n----------dbg:\n${ret.dbg.lni}`);
      candStartSig.push({ score: ret.score, props: startSig.props, dbg: ret.dbg, idxStartSig: i });
    }
  }
  //* Select the best candidate. Prefer higher score but also close to the bottom of the email (where we expect to find sigs)
  if (candStartSig.length > 0) {
    const rankedCands = _.orderBy(candStartSig, 'score', 'desc');
    let cand = rankedCands[0];

    tryExtractSig(rankedCands[0], lines, { bodyNoSig }, ret);
    if (!ret.found) {
      //* Try names and 'sent from My' (Email client vendor sig) at the last line of email, even if not enough score
      const lastLineCands = rankedCands.filter((cand) => cand.props.lastLineSig && (lines.length - cand.idxStartSig) === 1);
      if (lastLineCands.length > 0) {
        tryExtractSig(lastLineCands[0], lines, { bodyNoSig }, ret);
        if (ret.found) { cand = lastLineCands[0]; }
      }
    }
    //console.log(`found=${ret.found} idxStartSig=${cand.idxStartSig} score=${cand.score} lines.length - idxStartSig=${lines.length - cand.idxStartSig} candStartSig.length=${candStartSig.length}\nsig:\n----------\n${ret.signature}\ndbg:\n- - - - - - \n${ret.dbg.lni}`);
  }
  if (ret.found) {
    const { idxLineStartSig } = ret;
    const linesWithSeparator = body.split(/([\r\n]+)/);
    const bodyWithoutSigLen = _.take(linesWithSeparator, 2 * idxLineStartSig).join("").length;
    ret.characterOffsetBegin = bodyWithoutSigLen;
    ret.characterOffsetEnd = body.length;
    ret.signature = body.slice(bodyWithoutSigLen);
  }
  return ret;

}

function removeSignature(body, from) {
  const ret = getSignature(body, from, true);
  return ret.found ? ret.bodyNoSig : body;
}


module.exports = {
  getSignature,
  removeSignature,
  maybePhone,   //For testing
  maybeEmail,   //For testing
  isUrl,        //For testing
  isSentFromMy, //For testing
  getSenderScore, //For testing
  maybeStartSig,
  isListLine,
  isLongLine,
  getSignatureScore,
  isEmbeddedImage,
  isInternetService
}