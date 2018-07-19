# Email Signature Detector 
Extracts signatures from emails.  


## Usage 

### Node 

Install: npm install email-signature-detector

```js
const signature = require('email-signature-detector');

const body = `Dave,

See ticket #50366

Why do we issue this

Ron

Ron Smith
VP, Product Solutions
acme.com<http://acme.com/>
714.949.3001, rons@acme.com`;
  
const from = { email: 'rons@acme.com', displayName: 'Ron Smith' };
const ret = signature.getSignature(body,from);

```
### Browser 

TBD

##	API Reference

### getSignature(body,from,bodyNoSig)
returns - { signature: the signature text, bodyNoSig: see optional bodyNoSig parameter below }
body - contains the email body text 
from - optional: contains email and displayName used to detect the sender name in the signature. (see example in Usage)
bodyNoSig - optional: if true and the signature is found, the return object includes bodyNoSig : the email text until the beginning of the signature. 

### removeSignature(body,from)
returns - the email text until the beginning of the signature
body - contains the email body text 
from - optional: contains email and displayName used to detect the sender name in the signature. (see example in Usage)

 
## Limitations and known issues

### Limitations

- This library is intent to be used in the context of entreprise emails. It doens't work well for personal emails

### Known issues

- When a signature contains a job title that is very long (contains more that 10 words),  it is not properly detected as a signature. We believe (and hope) that very long job tiltes are not very common.
- Forwarded email thread with several messages and several signatures: what happens in this case?

## How does it work ?

Currently, the library implements a simple algorithm to detect candidate signature starts, and score each by examining the lines following the start.

For example, words such as Thanks and Regards, when used in short lines are considerd a candidate. the score of each candidate is determined by the content of the following lines, such as phone number, email address, url, sender name.

Note: The detectors of phone numbers, email addresses and urls are simple and their purpose is to support the signature scoring. They shouldn't be used standalone. refer to a specialized detector and validation libraries for that.      

## Roadmap and Contributions

### Currently, only English is supported.
