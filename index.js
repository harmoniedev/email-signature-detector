const _ = require('lodash');
const per = require('email-util/per');
const phone = require('email-util/phone');

function splitLine(line) {
    const re = /\s/;
    return line.split(re);
}

const MAX_SIG_NUM_LINES = 18;

function maybeEmail(str) {
    const re = /\S@\S/;
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
    const re = /skype:|skype\s{0,5}id:|\(skype\)|twitter|facebook|linkedin|blog|youtube/;
    return re.test(String(str).toLowerCase());
}


function isSentFromMy(str) {
    const re = /\s{0,5}sent from my/;
    return re.test(String(str).toLowerCase());
}


function isShortLine(line) {    
    return splitLine(line).length <= 4;
}

function isLongLine(line) {    
    return splitLine(line).length > 5;
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
    const idx = normLine.indexOf(tok);
    if (idx != -1) {
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
    }

  } //End for tok

  if (nMatchToks === 0) { 
    score = 0;
  } else if (requireCloseStart && (minSenderIdx > maxDistFromStartLine)) { //* Require name to be close to start of the line (avoid long lines that are part of email body that mentions sender name)
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
function maybeStartSig(line, arrSenderTok) {
    let startSig = false;
    const distFromStartLine = 5;
    let distFromEndLine = 15;
    const normline = String(line).toLowerCase().trim();
    let m = normline.match(/\s{0,5}sent from my/);
    if (m && m.length > 0) {    
        if (m.index <= distFromStartLine && normline.length - (m.index + m[0].length) < 40/*distFromEndLine*/ ) {
            startSig = true;
        }        
    }
    if (!startSig) {
        const re = /thank.{1,30}regards|thank you|thanx|thanks|thanks|many thanks|regard|sincerely|best|with appreciation|with gratitude|yours truly|cheers|faithfully|^[\s]*---*[\s]*$|^[\s]*___*[\s]*$/;
        m = normline.match(re);
        if (m && m.length > 0) {    
            if (m.index <= distFromStartLine && normline.length - (m.index + m[0].length) < distFromEndLine ) {
                startSig = true;
            }        
        }
    }
    if (!startSig) {
      startSig = !maybeEmail(line) &&  getSenderScore(line,arrSenderTok,true) >= 1;
    }
    return startSig;
}

function getSignatureScore(idxStartSig,idxEndSig, lines, arrSenderTok) {
    let score = 0;
    for (let i = idxStartSig + 1; i < idxEndSig; ++i) {
        const line = lines[i];
        if (maybeEmail(line)  || maybePhone(line) || isUrl(line) || isInternetService(line) || isSentFromMy(line))  {
            //console.log(`score line=${line}`);
            score += 1;
        } else if (getSenderScore(line,arrSenderTok,true) > 0) {
            score += 1;
        } else if (isShortLine(line) || isListLine(line)) {
            score += 0.25;
        } else if (isLongLine(line)) {
          //If long line and didn't find any sig-hint (url, phone, list ...) --> may be a false sig start that include many text line below it --> penalize score 
          //Long-lines should penalize more if not enough evidence (score) is accumulated from idxStartSig until current long line
          //Ex: Thanks at the beginning --> short email (2-3 long lines) --> long signature (many good sig lines) without a  maybeStartSig --> may cut entire email !!!
          //If, on the other hand, there are several anti-virus/ecological/legal/marketing advertisment long lines AFTER or in a MIDDLE of a good signature (score is higher) --> penalize less
          score -= score > 2 ? 0.5 : 0.75; 
        }               
    }   
    return score;
}

//from.email || from.mail, from.displayName
function getSignature(body, from, bodyNoSig) {
    let ret = { signature : '', found : false };    
    const { arrNameTok } = per.parseMailTokens( from );
    const lines = body.match(/[^\r\n]+/g);
    if (!lines ) { return ret; }
    
    
    //The first line cannot be a signature. It has to start <= MAX_SIG_NUM_LINES lines from the end.
    const startLine = Math.max(lines.length - MAX_SIG_NUM_LINES,1);
    //Collect candidates for sig, score each one.
    const candStartSig = [];
    for (let i = startLine ; i < lines.length; ++i) { 
        if (maybeStartSig(lines[i], arrNameTok) )  {                
            const score = getSignatureScore(i,lines.length,lines,arrNameTok);
            //console.log(`maybeStartSig score=${score} line num/total ${i}/${lines.length} line=${lines[i]} `);
            candStartSig.push({score,idxStartSig : i});
        }
    }
    //* Select the best candidate. Prefer higher score but also close to the bottom of the email (where we expect to find sigs)
    if (candStartSig.length > 0) {
        const rankedCands = _.orderBy(candStartSig,'score','desc');    
        const { score, idxStartSig } = rankedCands[0];    

        let idxStartFinalSig = -1;
        //* Require > 4 or 30% lines, after the startSig, looks like one of the above signature clues.
        if (score >= 4 || (score / (lines.length - idxStartSig) >= 0.3 ) ) {
            //* Limit to delete only 16 lines from the end of the email (not after the startSig)
            idxStartFinalSig =  Math.max(lines.length - MAX_SIG_NUM_LINES, idxStartSig);
            ret.signature = lines.slice(idxStartFinalSig).join('\r\n');            
            ret.found = true;
            if (bodyNoSig) {
                ret.bodyNoSig = lines.slice(0,idxStartFinalSig).join('\r\n');
            }
        }
        //console.log(`found=${ret.found} idxStartFinalSig=${idxStartFinalSig} idxStartSig=${idxStartSig} score=${score} candStartSig.length=${candStartSig.length}\nsig:\n----------\n${ret.signature}`);
    }
    return ret;
        
}


module.exports = {
   getSignature,    
   maybePhone,   //For testing
   maybeEmail,   //For testing
   isUrl,        //For testing
   isSentFromMy, //For testing
}