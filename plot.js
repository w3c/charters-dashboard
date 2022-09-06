function lastOf(array, offset = 0) {
    return array[array.length - 1 - offset];
}

function duration(d1, d2) {
    return Math.round((new Date(d1) - new Date(d2)) / (3600*24*1000*30));
}

var margin = {top: 30, right: 50, bottom: 30, left: 50},
    width = 800 - margin.left - margin.right,
    height = 800 - margin.top - margin.bottom;
var dateFormat = d3.timeFormat("%Y-%m-%d") ;
var parseDate = d3.timeParse("%Y-%m-%d");

// Set the ranges
var x = d3.scaleTime().range([0, width]);
var y = d3.scaleLinear().range([height, 0]);

// Define the axes
var xAxis = d3.axisBottom(x).ticks(17);

// setup fill color
var cValue = function(d) { return d.repeat;},
    color = d3.scaleLinear().domain([-1, 0, 1,6]).range(["#CFC", "white",  "yellow","red", ]);

// Adds the svg canvas
var svg = d3.select("body")
    .append("svg")
    .attr("width", width + margin.left + margin.right + 300)
    .attr("height", height + margin.top + margin.bottom)
    .style("background-color", "#333")
    .append("g")
    .attr("aria-busy", true)
    .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

var summary = d3.select("body")
    .append("section")
    .attr("aria-busy", true);

summary.append("h2")
    .text("Charters needing attention");

summary.append("section")
    .attr("id", "expired")
    .append("h3")
    .text("Groups with expired charters");
d3.select("#expired")
    .append("ul");

summary.append("section")
    .attr("id", "expiring")
    .append("h3")
    .text("Groups whose charter expires in less than 3 months");
d3.select("#expiring")
    .append("ul");

// filter for background color on text
var filter = d3.select("svg")
    .append("defs")
    .append("filter")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 1)
    .attr("height", 1)
    .attr("id", "solid");
filter.append("feFlood")
    .attr("flood-color", "black")
    .attr("flood-opacity", "0.8");
filter.append("feComposite")
    .attr("in", "SourceGraphic");

var radius = 4;

requirejs.config({
    paths: {
        "w3capi": "https://w3c.github.io/node-w3capi/lib/w3capi"
    }
});

const shorten = g => g.name.replace("Working Group", "WG").replace("Interest Group", "IG");

requirejs(['w3capi'], function(w3capi) {
    w3capi.apiKey = 'tqdjj949r5cossgggw0ow8ow4kks44c'; // Your API key.
    w3capi.authMode = 'param';
    var groups = {};
    var charter = [];
    w3capi.groups().fetch(function(err, data) {
        var wgs = data.filter(x => x.title.match(/(Working|Interest) Group$/));
        var notdone = wgs.length;
        wgs.forEach(function(g) {
            const [type, shortname] = [lastOf(g.href.split('/'), 1), lastOf(g.href.split('/'))];
            groups[type + '-' + shortname] = {name: g.title, charters:[], shortname, type, id: type + '-' + shortname};
            return w3capi.group({type, shortname}).charters().fetch({ embed: true }, function(err, charterlist) {
              (charterlist || []).forEach((c,i) => {
                    var charter = {uri: c.uri, periods : []};
                    charter.periods.push({
                        start: parseDate(c.start),
                        end: parseDate(c['initial-end']),
                        duration: duration(c['initial-end'], c.start),
                        cfp: c['cfp-uri'],
                        repeat: groups[type + '-' + shortname].charters.length > 0 ? 0 : -1});
                    var baseDate = c['initial-end'];
                    c.extensions.sort((a,b) => new Date(a.end) - new Date(b.end)).forEach((e,i) => {
                        charter.periods.push({start: parseDate(baseDate),
                                              end: parseDate(e.end),
                                              duration: duration(e.end, baseDate),
                                              repeat: i + 1,
                                              cfp: e['announcement-uri']
                                             });
                        baseDate = e.end;
                    });
                    groups[type + '-' + shortname].charters.push(charter);
                });
                notdone --;
                if (!notdone) {
                    dataGathered(groups);
                }
            });
        });
    });

    function dataGathered(groups) {
        var groupHistory = d3.values(groups).map(g => (g.charters.map(c => c.periods)));
        var sortedGroupIds = d3.keys(groups).sort((a,b) => lastOf(lastOf(groups[a].charters).periods).end - lastOf(lastOf(groups[b].charters).periods).end);
        var groupHeight = height / (Object.keys(groups).length + 1);
        var flatHistory = groupHistory.reduce((a,b) => a.concat(b), []).reduce((a,b) => a.concat(b), []);
        var now = new Date();
        var defaultExtent = [new Date().setMonth(now.getMonth() - 24), new Date().setMonth(now.getMonth() + 6)];
        x.domain(defaultExtent).nice();
        var zoom = d3.zoom()
            .translateExtent([[x(parseDate("1994-01-01")),0],[x(d3.max(flatHistory, d => d.end)) + 400 + margin.right,height]])
            .scaleExtent([.1,5])
            .on("zoom", draw);
        svg.append("rect")
            .attr("class", "pane")
            .attr("fill", "none")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.bottom + margin.top)
            .attr("y", -margin.top)
            .attr("x", -margin.left)
            .call(zoom);

        var latestCharters = d3.values(groups).map(g => { return {id: g.type + '-' + g.shortname, name: g.name, charter: lastOf(g.charters), period: lastOf(lastOf(g.charters).periods)};});
        var expiredCharters = latestCharters.filter(c => c.period.end < now)
            .sort((a,b) => a.period.end - b.period.end);
        var expiringCharters = latestCharters.filter(c => c.period.end > now && c.period.end < new Date().setMonth(new Date().getMonth() + 3))
            .sort((a,b) => a.period.end - b.period.end);

        d3.select("#expired")
            .select("ul")
            .selectAll("li")
            .data(expiredCharters)
            .enter()
            .append("li")
            .append("a")
            .attr("href", d => d.charter.uri)
            .text(d => d.name + " expired on " + dateFormat(d.period.end));
        d3.select("#expiring")
            .select("ul")
            .selectAll("li")
            .data(expiringCharters)
            .enter()
            .append("li")
            .append("a")
            .attr("href", d => d.charter.uri)
            .text(d => d.name + " expires on " + dateFormat(d.period.end));



        var groupEnter = svg.selectAll("g.group").data(d3.values(groups))
            .enter();

        var groupEls = groupEnter
            .append("g")
            .attr("id", d => "g" + d.id)
            .attr("focusable", true)
            .attr("tabIndex", 0)
            .attr("class", "group")
            .attr("role", "region")
            .attr("aria-labelledby", d => "title-" + d.id);
        groupEls
            .insert("foreignObject")
            .attr("width", 340)
            .attr("height", 400)
            .attr("x", width + 10)
            .attr("y", 170)
            .attr("id", function(d) { return "pane-" + d3.select(this.parentNode).datum().id})
            .append("xhtml:div").attr('class','grouppane');

        groupEls
            .append("title")
            .attr("id", d => "title-" + d.id)
            .text(d => "History of charters for the " + d.name);

        svg.selectAll("g.group").selectAll("div.grouppane").selectAll("div.charter")
            .data(d => d.charters.slice().reverse())
            .enter()
            .append("div")
            .attr("class","charter")
            .append("p")
            .append("a")
            .attr("href", d => d.uri)
            .text((d,i,a ) => "#" + (a.length - i) + " charter");
        svg.selectAll("div.charter")
            .append("ul").selectAll("li")
            .data(d=>d.periods)
            .enter()
            .append("li")
            .append("a").attr("href", d => d.cfp ? d.cfp : undefined)
            .text((d,i,a) => (d.repeat <= 0 ? "chartered on " : "extended on ") + dateFormat(d.start) + " for " + d.duration + " month" + (d.duration > 1 ? "s" : "") + " " + (i == a.length - 1 ? " ending on " + dateFormat(d.end) : ""));

        var groupLinks = svg.selectAll("g.group")
            .append("a")
            .attr("aria-controls", "groupSelector")
            .attr("xlink:href", function(d)  {return "#g" + d3.select(this.parentNode).datum().id;});

        groupLinks
            .selectAll("g.charter")
            .data(d => d.charters)
            .enter()
            .append("g")
            .attr("class","charter")
            .selectAll("rect")
            .data(d => d.periods)
            .enter()
            .append("rect")
            .attr("y", function(d)  { return sortedGroupIds.indexOf(d3.select(this.parentNode.parentNode.parentNode).datum().id) * groupHeight;})
            .attr("aria-labelledby", function(d) { return "title-" + d3.select(this.parentNode.parentNode.parentNode).datum().id + "-" + d.repeat;})
            .attr("role", "img")
            .attr("height", groupHeight)
            .style("fill", d => color(cValue(d)))
            .call(zoom)
            .append("title")
            .attr("id", function(d) { return "title-" + d3.select(this.parentNode.parentNode.parentNode.parentNode).datum().id + "-" + d.repeat;})
            .text(function(d) { return (d.repeat > 0 ? "Extension #" +  d.repeat   : "New charter") + " for " + d3.select(this.parentNode.parentNode.parentNode.parentNode).datum().name + " of " + d.duration + " months"  + " on " + dateFormat(d.start) + " ending on " + dateFormat(d.end)});

        groupLinks
            .append("text")
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "central")
            .attr("filter", "url(#solid")
            .attr("class", d => { var end = lastOf(lastOf(d.charters).periods).end ; return end < new Date() ? "outofcharter" : (end < new Date().setMonth(new Date().getMonth() + 3) ? "soonooc" : undefined)} )
            .attr("y", d => sortedGroupIds.indexOf(d.id)*groupHeight + groupHeight / 2)
            .text(shorten);

        svg.append("line")
            .attr("class", "policy")
            .attr("y1", y(0))
            .attr("y2", -5)
            .style("stroke-width", 2)
            .style("stroke", "#FAA");
        svg.append("a")
            .attr("xlink:href", "https://www.w3.org/2015/04/charter-extensions.html")
            .append("text")
            .attr("class", "policy")
            .attr("y", -5)
            .attr("text-anchor", "end")
            .text("New policy");

        svg.append("line")
            .attr("class", "today")
            .attr("y1", y(0))
            .attr("y2", -5)
            .style("stroke-width", 2)
            .style("stroke", "#FAA");
        svg.append("text")
            .attr("class", "today")
            .attr("y", -5)
            .attr("text-anchor", "end")
            .text("Today");

        svg.append("line")
            .attr("class", "months3")
            .attr("y1", y(0))
            .attr("y2", -5)
            .style("stroke-width", 1)
            .style("stroke-dasharray", "1 1")
            .style("stroke", "#FAA");
        svg.append("text")
            .attr("class", "months3")
            .attr("y", -5)
            .attr("text-anchor", "start")
            .text("in 3 months");



        var legendRectSize = 20, legendSpacing = 5;
        
        var legend = d3.select('svg')
            .append("g")
            .attr("class", "legendbox")
            .selectAll("g")
            .data([-1, 0,1,2,3,4,5,6])
            .enter()
            .append('g')
            .attr('class', 'legend')
            .attr('transform', function(d, i) {
                var x = width + margin.right + 10;
                var y = i * legendRectSize;
                return 'translate(' + x + ',' + y + ')';
            });

        d3.select("g.legendbox")
            .append('foreignObject')
            .attr("width", 320)
            .attr("height", 30)
            .attr("x", width + margin.right + 10)
            .attr("y", 9*legendRectSize)
            .append('xhtml:select')
            .attr('id', 'groupSelector')
            .append('option').text("View a specific group…")
        ;
        d3.select('select')
            .selectAll("option.group")
            .data(d3.values(groups).sort((a,b) => a.name < b.name ? -1 : 1))
            .enter()
            .append("option")
            .attr("class","group")
            .attr("aria-controls", d => "pane" + d.id)
            .attr("value", d => d.id)
            .property("selected", d => location.hash === '#g' + d.id ? 'selected'  : null)
            .text(shorten);

        document.getElementById('groupSelector')
            .addEventListener('change', function(e) {
                location.hash = '#g' + this.options[this.selectedIndex].value;
            });
        window.addEventListener("hashchange", updateView);
        function updateView() {
            document.querySelector("option[value='" + location.hash.slice(2) +"']")
                .selected = true;
            // needed because Chrome doesn't implement :target correctly?
            d3.selectAll("foreignObject[style]").attr("style", undefined);
            d3.select(document.querySelector("#" + location.hash.slice(1) + " foreignObject")).style("display", "block");
        };
        
        legend.append('circle')
            .attr('r', radius)
            .attr('cy', legendRectSize / 2)
            .style('fill', color)
            .style('stroke', color);

        legend.append('text')
            .attr('x', legendSpacing )
            .attr('y', legendRectSize - legendSpacing)
            .text(d =>  d > 0 ? "Extension #" + d : ( d === 0 ? "New charter" : "1st charter"));

        // Add the X Axis
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")");

        draw();
        function draw() {
            var clip = x => Math.min(x, width);
            var transform = d3.event ? d3.event.transform : d3.zoomIdentity;
            var xNewScale = transform.rescaleX(x);
            xAxis.scale(xNewScale)
            svg.select("g.x.axis").call(xAxis);
            var now = new Date();
            var months3 = new Date().setMonth(now.getMonth() + 3);
            svg.selectAll("line.policy")
                .attr("x1", xNewScale(parseDate("2015-06-18")))
                .attr("x2", xNewScale(parseDate("2015-06-18")));
            svg.selectAll("text.policy")
                .attr("x", xNewScale(parseDate("2015-06-18")));
            svg.selectAll("line.today")
                .attr("x1", xNewScale(now))
                .attr("x2", xNewScale(now));
            svg.selectAll("text.today")
                .attr("x", xNewScale(now));
            svg.selectAll("line.months3")
                .attr("x1", xNewScale(months3))
                .attr("x2", xNewScale(months3));
            svg.selectAll("text.months3")
                .attr("x", xNewScale(months3));
            svg.selectAll("g.group").selectAll("rect")
                .attr("x", d => xNewScale(d.start))
                .attr("width", d => Math.max(0, Math.min(width - xNewScale(d.start),xNewScale(d.end) - xNewScale(d.start))))
            svg.selectAll("g.group").selectAll("text")
                .attr("x", d => clip(shorten(d).length *4< xNewScale(d.charters[0].periods[0].start) - 3 ? xNewScale(d.charters[0].periods[0].start) - 3 : 0 - margin.left) )
            .attr("text-anchor", d => shorten(d).length *4 < xNewScale(d.charters[0].periods[0].start) - 3 ? "end" : "start")

            svg.attr("aria-busy", false)
            summary.attr("aria-busy", false)

        }
        updateView();
    }
});

