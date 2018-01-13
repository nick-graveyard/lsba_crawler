var fs = require('fs');
var co = require('co');
const Nightmare = require('nightmare');
nightmare = Nightmare({
  executionTimeout: 20000,
  openDevTools: {
    mode: 'detach'
  },
  show: true
});
const START = 'https://www.lsba.org/Public/MembershipDirectory.aspx';
//const MAX_PAGE = 5;
const WAIT_TIME = 100;
const city = 'Covington';

co(function*() {

  yield nightmare
    .goto(START)
    .type('#TextBoxCity', city)
    .click("#ButtonSearch")


  yield sleep(2000);
  next_exists = yield nextPageExists();
  current_page = 0;

  while (next_exists) {
    // Get all the person ids for the page
    yield sleep(2000);
    person_ids = yield getPersonIds();

    // cycle thru all person id's
    for (let i = 0; i < person_ids.length; i++) {
      try {
        var element = person_ids[i];
        console.log("Page:" + current_page + " Element:" + element);

        console.log("Click on element button");
        try {
          yield nightmare
            .wait("#" + element)
            .click("#" + element)
        } catch (error) {
          console.log("Failed clicking on person info: " + error.stack);
          throw "Error";
        }

        console.log("Obtaining Person Details");
        try {
          yield nightmare.wait("#divdetails")
          var person_info = yield getPersonInfo()
        } catch (error) {
          console.error("Failed finding person info: " + error.stack);
          throw "Error";
        }

        console.log("Storing Person Details in file");
        try {
          person_info = convertToCsv(person_info);
          fs.appendFileSync('./lsba.csv', person_info);
        } catch (e) {
          throw "Error";
        }

        console.log("Click the back button");
        try {
          yield nightmare
            .wait("#Button1")
            .click("#Button1")
        } catch (error) {
          console.error("Failed clicking back button: " + error.stack);
          throw error;
        }



      } //end try
      catch (e) {

        yield nightmare.end()

        nightmare = Nightmare({
          executionTimeout: 20000,
          openDevTools: {
            mode: 'detach'
          },
          show: true
        });

        yield nightmare.wait(20000)

        yield nightmare
          .goto(START)
          .type('#TextBoxCity', city)
          .click("#ButtonSearch")
        yield nightmare.wait(10000)

        goToPage(current_page);

        continue;
      } //end catch
    } // end for loop
    // beginning of next page logic inside outer loop
    console.log("Click the next page button");
    try {
      yield nightmare
        .wait('input[name="DataPager1$ctl00$ctl01"]')
        .click('input[name="DataPager1$ctl00$ctl01"]')
    } catch (error) {
      console.error("Failed clicking on Next Page: " + error.stack);
      throw error;
    }

    console.log("Testing if there are next pages");
    try {
      yield nightmare.wait('input[name="DataPager1$ctl00$ctl01"]')
      next_exists = yield nextPageExists();
    } catch (error) {
      console.error("Failed clicking on Next Page: " + error.stack);
      throw error;
    }

    current_page = current_page + 1;
  } // end while loop
}).catch(onerror);


function goToPage(pagenumber) {
  co(function*() {
    for (let i = 0; i < pagenumber; i++) {
      yield nightmare
        .wait('input[name="DataPager1$ctl00$ctl01"]')
        .click('input[name="DataPager1$ctl00$ctl01"]')
    }
  })
}

function nextPageButtonExists() {
  return nightmare.visible('input[name="DataPager1$ctl00$ctl01"]');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nextPageExists() {
  return nightmare.evaluate(() => {
    var x = document.getElementsByName('DataPager1$ctl00$ctl01')[0].getAttribute('disabled');
    if (x == 'disabled') {
      return false;
    }
    return true;
  });
}

function getPersonIds() {
  return nightmare.evaluate(() => {
    var links = Array.from(document.querySelectorAll("a[id*='LinkButton']"));
    var callback = element => element.innerText == 'View Details';
    var result = links.filter(callback);
    var ids = result.map(e => e.id);
    return ids;
  });
}

function getPersonInfo(element) {
  return nightmare.evaluate(() => {
    var details = document.querySelectorAll("#divdetails")[0].innerText.split("\n");
    var out = {
      "full_name": details[0],
      "date_admitted": details[1].replace('Date Admitted:', '').trim(),
      "is_eligible": details[2].trim(),
      "addy1": details[4].trim(),
      "addy2": details[5].trim(),
      "phone": details[6].replace('Phone:', '').trim(),
      "fax": details[7].replace('Fax:', '').trim(),
      "email": details[8].replace('Email:', '').trim(),
      "web_site": details[9].replace('Web Site:', '').trim(),
      "firm": details[10].replace('Firm:', '').trim(),
      "board_district": details[11].replace('Board District:', '').trim(),
      "judicial_district": details[12].replace('Judicial District:', '').trim(),
      "parish": details[13].replace('Parish:', '').trim(),
      "status_actions": document.querySelectorAll("#divreasons")[0].innerText.replace('Open Status Actions:', '').replace('\n', "|")
    };

    return JSON.stringify(out);
  });
}

function getCSVHeaders() {
  var headers = `
    full_name,
    date_admitted,
    is_eligible,
    addy1,
    addy2,
    phone,
    fax,
    email,
    web_site,
    firm,
    board_district,
    judicial_district,
    parish,
    status_actions
  `;
  headers = headers.split(',').map(element => element.replace(/(\r\n|\n|\r)/gm, "").trim());
  return headers;
}

function convertToCsv(json_in_string) {
  data = JSON.parse(json_in_string);
  person_info = `
    ${data["full_name"]};
    ${data["date_admitted"]};
    ${data["is_eligible"]};
    ${data["addy1"]};
    ${data["addy2"]};
    ${data["phone"]};
    ${data["fax"]};
    ${data["email"]};
    ${data["web_site"]};
    ${data["firm"]};
    ${data["board_district"]};
    ${data["judicial_district"]};
    ${data["parish"]};
    ${data["status_actions"]}
`;
  person_info = person_info.split(';').map(element => element.replace(/(\r\n|\n|\r)/gm, "").replace(";", "").trim());
  return person_info.join(";") + "\n";
}

function onerror(err) {
  console.error(err.stack);
}
