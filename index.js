const _ = require('lodash');
const per = require('email-util/per');
const phone = require('email-util/phone');
const marketing = require('email-util/marketing');

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

function numWords(line) {    
    return splitLine(line).filter((tok)=>tok.length > 1 && tok.match(/[a-zA-Z]/) != null).length;
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
	const wholeWordTokPat = '\\b'+tok+'\\b';    
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
  }  else if (requireCloseStart && (minSenderIdx > maxDistFromStartLine) || numWords(line) >= 10) { //* Require name to be close to start of the line (avoid long lines that are part of email body that mentions sender name)
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
        const re = /thank.{1,30}regards|thank {0,3}you|thanx|thanks|many {0,3}thanks|regard|sincerely|all {0,3}the {0,3}best|best|with {0,3}appreciation|with {0,3}gratitude|yours {0,3}truly|cheers|faithfully|^[\s]*---*[\s]*$|^[\s]*___*[\s]*$/;
        m = normline.match(re);
        if (m && m.length > 0) {    
            if (m.index <= distFromStartLine && normline.length - (m.index + m[0].length) < distFromEndLine ) {
                startSig = true;
            }        
        }
    }
    let isSender = false;
    if (!startSig) {
      startSig = isSender = !maybeEmail(line) &&  getSenderScore(line,arrSenderTok,true) >= 1;
    }
    return  { found: startSig, props: { isSender }};
}

const SCORE_SIG_LINE = 1;
const SCORE_EMBEDDED = 0.5;
const SCORE_URL_LONG_LINE = 0.25;
const SCORE_SHORT_LIST_LINE = 0.25;
const SCORE_LONG_LINE_LOW = -0.5;
const SCORE_LONG_LINE_HIGH = -0.75;

function getSignatureScore(idxStartSig,idxEndSig, lines, arrSenderTok, startSig) {
    let score = 0;    
    let lni = '';
    for (let i = idxStartSig + 1; i < idxEndSig; ++i) {
        const origLine = lines[i];
        const iterLines = isListLine(origLine) ? origLine.split('|') : [origLine];
        for (const line of iterLines) {
          if (maybeEmail(line)  || maybePhone(line) || isInternetService(line) || isSentFromMy(line))  {
              lni += (`>> +${SCORE_SIG_LINE} line=${line}\n`);
              score += SCORE_SIG_LINE;
          } else if (getSenderScore(line,arrSenderTok,true) > 0) {
              lni += (`>> sender +${SCORE_SIG_LINE} line=${line}\n`);
              score += SCORE_SIG_LINE;
          } else if (isUrl(line)) {
              const numWords = splitLine(line).length;
              //Score urls less as they appear in a longer line (probably not a signature, but a regular email line)
              
              const urlScore = numWords < 15 || isListLine(line) || mayBeUnsubscribe(line) ? SCORE_SIG_LINE : SCORE_URL_LONG_LINE;
              lni +=(`>> url ${urlScore} line=${line}\n`);
              score +=  urlScore; 
          } else if (isEmbeddedImage(line)) {
            lni +=(`>> cid +${SCORE_EMBEDDED} line=${line}\n`);
            score += SCORE_EMBEDDED;    
          } else if (isShortLine(line)) {
              lni += (`>> short +${SCORE_SHORT_LIST_LINE} line=${line}\n`);
              score += SCORE_SHORT_LIST_LINE;
          } else if (isLongLine(line) && !mayBeUnsubscribe(line)) {
            const longScore =  score > 2 ? SCORE_LONG_LINE_LOW : SCORE_LONG_LINE_HIGH;
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

function tryExtractSig({score, dbg, idxStartSig, props },lines, { bodyNoSig }, ret) {
    let idxStartFinalSig = -1;
      //* Require > 4 or 30% lines, after the startSig, looks like one of the above signature clues.
      if (score >= 4 || 
         (score / (lines.length - idxStartSig) >= 0.3 ) || 
         (props.isSender && (lines.length - idxStartSig) === 1)) {
          //* Limit to delete only 16 lines from the end of the email (not after the startSig)
          idxStartFinalSig =  Math.max(lines.length - MAX_SIG_NUM_LINES, idxStartSig);
          ret.signature = lines.slice(idxStartFinalSig).join('\r\n');            
          ret.found = true;
          if (bodyNoSig) {
              ret.bodyNoSig = lines.slice(0,idxStartFinalSig).join('\r\n');
          }
      } 
      ret.dbg = { ...ret.dbg, ...dbg };
}

//from.email || from.mail, from.displayName
function getSignature(body, from, bodyNoSig) {
    let ret = { signature : '',  found : false, dbg: {} };    
    const { arrNameTok } = per.parseMailTokens( from );
    const lines = body.match(/[^\r\n]+/g);
    if (!lines ) { return ret; }
    
    
    //The first line cannot be a signature. It has to start <= MAX_SIG_NUM_LINES lines from the end.
    const startLine = Math.max(lines.length - MAX_SIG_NUM_LINES,1);
    //Collect candidates for sig, score each one.
    const candStartSig = [];
    for (let i = startLine ; i < lines.length; ++i) {
        const startSig = maybeStartSig(lines[i], arrNameTok); 
        if ( startSig.found )  {              
        
            const ret = getSignatureScore(i,lines.length,lines,arrNameTok, startSig);            
            //console.log(`candidate: score=${ret.score} idxStartSig=${i}  lines.length - idxStartSig=${lines.length - i}\n----------dbg:\n${ret.dbg.lni}`);
            candStartSig.push({score: ret.score, props : startSig.props, dbg: ret.dbg, idxStartSig : i});
        }
    }
    //* Select the best candidate. Prefer higher score but also close to the bottom of the email (where we expect to find sigs)
    if (candStartSig.length > 0) {
        const rankedCands = _.orderBy(candStartSig,'score','desc');    
        let cand = rankedCands[0];    

        tryExtractSig(rankedCands[0],lines, { bodyNoSig }, ret);
        if (!ret.found) {
          //* Try name only at the end of email sig (even if not enough score)
          const nameAtEndCands = rankedCands.filter((cand)=> cand.props.isSender && (lines.length - cand.idxStartSig) === 1);
          if (nameAtEndCands.length > 0) {
            tryExtractSig(nameAtEndCands[0], lines, { bodyNoSig }, ret);
            if (ret.found) { cand = nameAtEndCands[0]; }
          }  
        }
        //console.log(`found=${ret.found} idxStartSig=${cand.idxStartSig} score=${cand.score} lines.length - idxStartSig=${lines.length - cand.idxStartSig} candStartSig.length=${candStartSig.length}\nsig:\n----------\n${ret.signature}\ndbg:\n- - - - - - \n${ret.dbg.lni}`);
    }
    return ret;
        
}

function removeSignature(body,from) {
  const ret = getSignature(body,from,true);
  return ret.found ? ret.bodyNoSig : body;
}

// const body = `___
// ה הזמן לסקר היומי....
// הצביעו והשפיעו !!
// סקר:
// סמן ליד המנות אותן אכלת, את דרגת שביעות רצונך מהמנה.
// עוף   - 1-6, לא אכלתי
// הערות:
// Elina Maimon
// Administration Manager
// Main: +972-8-9781325|Cell: +972-52-3284900|Fax:+972 8 9219389
// [Description: Description: http://harmon.ie/sites/default/files/harmonhex2012_logo.png]<http://harmon.ie/>
// Please consider the environment before printing this e-mail
// `;

// const email = 'elinam@harmon.ie';
// const displayName = 'Elina Maimon';

// const body = `Hi Bye\r\nKobi Carlebach | CFO | harmon.ie Corporation
// M : +972-50-8313-154 |P: +972-8-9781384
// M (US): +1-408-449-4652
// 18 Abba Hillel Silver, Lod, 71294, Israel
// kobic@harmon.ie<mailto:kobic@harmon.ie> | [Description: Description: http://harmon.ie/sites/default/files/harmonhex2012_logo.png] <http://harmon.ie/>
// Please consider the environment before printing this e-mail
// `;

// const email = 'kobic@harmon.ie';
// const displayName = 'Kobi';

// const a_body = 'Test complex signature.\n' +
// 'Dekel Cohen\n' +
// 'IBM (Telelogic AB) Southern California Edison Company\n' +
// '1111 Farmington Avenue, Farmington, CT 11111-XXXX Office: 111.679.XXXX | Cell: 111.679.XXXX | Fax: 111.679.XXXXwww.att.com';

// const email = 'dekel@mail.com';
// const displayName = 'Dekel Cohen';


// const body = 'Test complex signature.\n\n________________________\n' +
// '\nDekel Cohen\n\nVice President, Product Strategy\n\nIBM (Telelogic AB). \n\nTel: +1-111-111-111\n\n' +
// 'Blog: http://ow.ly/gqVTU';

const from =  {
        "displayName" : "Andrei Malacinski/Raleigh/IBM", 
        "mail" : "malacins@us.ibm.com"
    }

const body = `Dekel,
        We've decided we want a technote notifying users of the emulation setting.  In the technote we want to identify the registry setting being used, the reason we set it (BludID support) and to let users know they can clear the setting if it is causing issues.  Can you please write the text for this technote and send it to me.  I will have our ID engineer review and post it.  Also, on our catalog landing page, we will post an informational sentence, such as:  Note:  The plugin makes a config change in Outlook to set its browser emulation mode IE10.  This is necessary for the proper rendering of the login panel, in certain cases.  Please see this technote for details.



Thanks!

Andrei Malacinski<http://w3.ibm.com/bluepages/simpleSearch.wss?searchBy=Name&location=All+locations&searchFor=malacinski,+andrei>
Development Manager, IBM Connections.  (IBM Collaboration Solutions)
IBM Corporation, B500/D117, 4205 S. Miami Blvd, RTP, NC, 27703-9141
E-mail: malacins@us.ibm.com; Phone: (919) 254-1474





From:        Andrei Malacinski/Raleigh/IBM
To:        "Dekel Cohen" <dekelc@harmon.ie>
Date:        01/26/2018 05:01 PM
Subject:        Emulation mode to 10
________________________________


Hi Dekel,
        I got confirmation from IBM support on your approach to set the IE emulation mode it 10 in the install.  They discussed with the customer (AT&T) and have their agreement.

        Please let me know when you post a build with this change (and also the new license and about panel translations) all together in the same build.


Thanks!

Andrei Malacinski<http://w3.ibm.com/bluepages/simpleSearch.wss?searchBy=Name&location=All+locations&searchFor=malacinski,+andrei>
Development Manager, IBM Connections.  (IBM Collaboration Solutions)
IBM Corporation, B500/D117, 4205 S. Miami Blvd, RTP, NC, 27703-9141
E-mail: malacins@us.ibm.com; Phone: (919) 254-1474
`;


//const ret = getSignature(body, from || {email, displayName},true);


//console.log(JSON.stringify(ret));

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