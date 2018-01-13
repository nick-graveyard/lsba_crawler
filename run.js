var fs = require('fs');
var co = require('co');
var nightmare;
const args = process.argv.slice(2); // normalize arguments
const Nightmare = require('nightmare');
const START = 'https://www.lsba.org/Public/MembershipDirectory.aspx';
const WAIT_TIME = 1000; // Dont'go less than 1000 due to web async issues
const city = args[0];
const filename = city.toLowerCase().replace(" " , "-") + ".csv"

current_page = 0;

co(function*() {
  while (true) {
    console.log("New Page:" + current_page)
    yield newNightmare();
    yield goToCityList();
    yield goToPage(current_page);
    console.log("Getting person Ids");
    person_ids = yield getPersonIds();
    console.log(person_ids);

    // cycle thru all person id's
    for (let i = 0; i < person_ids.length; i++) {
      try {
        var element = person_ids[i];
        console.log("Page:" + current_page + " Element:" + element);
        yield clickOnElement(element);
        person_info = yield getPersonInfo();
        console.log(person_info);
        savePersonToFileSync(person_info);
        yield clickBackButton();
      } catch (error) {
        console.log("Error encountered, retrying. " + error);

        // Catch a wierd async error between travelling to next page
        // and getting the element id's.
        // Happens on the last page of the search.
        element_exists = yield nightmare.exists("#".element);
        if (!element_exists) {
          console.log("Element doesn't exist. Ending person loop early.");
          break;
        }

        // Normal error handling
        yield endNightmare();
        yield newNightmare();
        yield goToCityList();
        yield goToPage(current_page);
        i = i - 1; // retry last element
      }
    }

    console.log('Checking next page existence.')

    next_exists = yield nextPageExists();
    if (!next_exists) {
      console.log("Finished processing city.");
      yield endNightmare();
      break;
    }

    console.log('Ending nightmare.')
    yield endNightmare();
    current_page = current_page + 1;
  }
}).catch(onerror);



// Functions
function waitforunload() {
  return new Promise(function(resolve, reject) {
    window.onbeforeunload = function() {
      resolve();
    };
  });
};

function clickBackButton() {
  return co(function*() {
    console.log("Click the back button");
    try {
      yield nightmare
        .wait(WAIT_TIME)
        .wait("#Button1")
        .click("#Button1")
    } catch (error) {
      console.error("Failed clicking back button: " + error.stack);
      throw error;
    }
  });
}

function savePersonToFileSync(person_info) {
  console.log("Storing Person Details in file");
  try {
    person_info = convertToCsv(person_info);
    fs.appendFileSync('./' + filename, person_info);
  } catch (error) {
    console.log('Failed storing person details in file.')
    throw error;
  }
}

function clickOnElement(element) {
  return co(function*() {
    console.log("Click on element button: " + element);
    try {
      yield nightmare
        .wait(WAIT_TIME)
        .wait("#" + element)
        .click("#" + element)
    } catch (error) {
      console.log("Failed clicking on person info: " + error.stack);
      throw error;
    }
  });
}

function getPersonDetails() {
  return co(function*() {
    console.log("Obtaining Person Details");
    try {

      // Navigate
      yield nightmare
        .wait(WAIT_TIME)
        .wait("#divdetails")

      // Get the info
      return getPersonInfo();

    } catch (error) {
      console.error("Failed finding person info: " + error.stack);
      throw error;
    }
  });
}

function newNightmare() {
  return co(function*() {
    nightmare = Nightmare({
      executionTimeout: 20000,
      waitTimeout: 20000,
      openDevTools: {
        mode: 'detach'
      },
      show: true
    });
  });
}

function goToCityList() {
  return co(function*() {
    yield nightmare
      .wait(WAIT_TIME)
      .goto(START)
      .type('#TextBoxCity', city)
      .click("#ButtonSearch")
      .wait(WAIT_TIME)
  });
}

function endNightmare() {
  return co(function*() {
    yield nightmare.end();
  });
}

function nextPage() {
  return co(function*() {
    yield nightmare
      .wait(WAIT_TIME)
      .wait('input[name="DataPager1$ctl00$ctl01"]')
      .click('input[name="DataPager1$ctl00$ctl01"]')
  })
}

// The last .wait is a hack. Need to be able to determine when a page is transitioned in an SPA
// This might require comparing two evaluates.
function goToPage(pagenumber) {
  return co(function*() {
    for (let page = 0; page < pagenumber; page++) {
      yield nightmare
        .wait(WAIT_TIME)
        .wait('input[name="DataPager1$ctl00$ctl01"]')
        .click('input[name="DataPager1$ctl00$ctl01"]')
        .wait(WAIT_TIME) // Note figure out how determine a page transition on an SPA.
    }
  })
}

function nextPageButtonExists() {
  return co(function*() {
    return yield nightmare.visible('input[name="DataPager1$ctl00$ctl01"]');
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nextPageExists() {
  return co(function*() {
    try {
      return yield nightmare
        .wait(WAIT_TIME)
        .wait('input[name="DataPager1$ctl00$ctl01"]')
        .evaluate(() => {
          var x = document.getElementsByName('DataPager1$ctl00$ctl01')[0].getAttribute('disabled');
          if (x == 'disabled') {
            return false;
          }
          return true;
        });
    } catch (error) {
      console.error("Failed clicking on Next Page: " + error.stack);
      throw error;
    }
  });
}

function getPersonIds() {
  return co(function*() {
    return yield nightmare.evaluate(() => {
      var links = Array.from(document.querySelectorAll("a[id*='LinkButton']"));
      var callback = element => element.innerText == 'View Details';
      var result = links.filter(callback);
      var ids = result.map(e => e.id);
      return ids;
    });
  });
}

function getPersonInfo(element) {
  return co(function*() {
    return yield nightmare
      .wait('#divdetails')
      .evaluate(() => {
        var details = document.querySelectorAll("#divdetails")[0].innerText.split("\n");

        var is_private = details.includes('Private Member');

        if (is_private) {
          var out = {
            "full_name": details[0],
            "date_admitted": details[1].replace('Date Admitted:', '').trim(),
            "is_eligible": details[2].trim(),
            "addy1": "private",
            "addy2": "private",
            "phone": "private",
            "fax": "private",
            "email": "private",
            "web_site": "private",
            "firm": "private",
            "board_district": "private",
            "judicial_district": "private",
            "parish": "private",
            "status_actions": document.querySelectorAll("#divreasons")[0].innerText.replace('Open Status Actions:', '').replace('\n', "|")
          };
          return JSON.stringify(out);
        }

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
