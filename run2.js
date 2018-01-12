var Nightmare = require('nightmare');
var vo = require('vo');
vo(run)(function(err, result) {
if (err) throw err;
});

function* run() {
var nightmare = Nightmare(),
MAX_PAGE = 10,
currentPage = 0,
nextExists = true,
links = [];

yield nightmare
    .goto('https://www.yahoo.com')
    .type('#uh-search-box', 'github nightmare')
    .click('#uh-search-button')
    .wait('ol.searchCenterMiddle')


nextExists = yield nightmare.visible('.next');

while (nextExists && currentPage < MAX_PAGE) {
    links.push(yield nightmare
        .evaluate(function() {
            var links = document.querySelectorAll("ol.searchCenterMiddle a");
            console.log(links[0].href);
            return links[0].href;
        }));

        yield nightmare
            .click('.next')
            .wait('body')

        currentPage++;
        nextExists = yield nightmare.visible('.next');
}
console.dir(links);
yield nightmare.end();
}
