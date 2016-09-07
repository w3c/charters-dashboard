function lastOf(array) {
    return array[array.length - 1];
}

function duration(d1, d2) {
    return Math.round((new Date(d1) - new Date(d2)) / (3600*24*1000*30));
}

var margin = {top: 30, right: 50, bottom: 30, left: 50},
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;
var dateFormat = d3.time.format("%Y-%m-%d") ;
var parseDate = dateFormat.parse;

// Set the ranges
var x = d3.time.scale().range([0, width]);
var y = d3.scale.linear().range([height, 0]);

// Define the axes
var xAxis = d3.svg.axis().scale(x)
    .orient("bottom").ticks(17);

// setup fill color
var cValue = function(d) { return d.repeat;},
    color = d3.scale.linear().domain([-1, 0, 1,6]).range(["#0F0", "white",  "yellow","red", ]);

// Adds the svg canvas
var svg = d3.select("body")
    .append("svg")
    .attr("width", width + margin.left + margin.right + 300)
    .attr("height", height + margin.top + margin.bottom)
    .style("background-color", "#333")
    .append("g")
    .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

var radius = 4;

requirejs.config({
    paths: {
        "w3capi": "https://w3c.github.io/node-w3capi/lib/w3capi"
    }
});


requirejs(['w3capi'], function(w3capi) {
    w3capi.apiKey = 'tqdjj949r5cossgggw0ow8ow4kks44c'; // Your API key.
    w3capi.authMode = 'param';
    var groups = {};
    var charter = [];
    w3capi.groups().fetch(function(err, data) {
        var wgs = data.filter(x => x.title.match(/Working Group/));
        var notdone = wgs.length;
        wgs.forEach(function(g) {
            var gid = lastOf(g.href.split('/'));
            groups[gid] = {name: g.title, charters:[], id:gid};
            return w3capi.group(gid).charters().fetch({ embed: true }, function(err, charterlist) {
                charterlist.forEach((c,i) => {
                    var charter = {uri: c.uri, periods : []};
                    charter.periods.push({
                        start: parseDate(c.start),
                        end: parseDate(c['initial-end']),
                        duration: duration(c['initial-end'], c.start),
                        cfp: c['cfp-uri'],
                        repeat: groups[gid].charters.length > 0 ? 0 : -1});
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
                    charter.periods.push({start: parseDate(baseDate),
                                          end: null,
                                          duration: 0,
                                          repeat: 0.5
                                         });
                    groups[gid].charters.push(charter);
                });
                notdone --;
                if (!notdone) {
                    dataGathered(groups);
                }
            });
        });
    });

    function dataGathered(groups) {
        var zoom = d3.behavior.zoom()
            .on("zoom", draw);
        svg.append("rect")
            .attr("class", "pane")
            .attr("fill", "none")
            .attr("width", width)
            .attr("height", height)
            .call(zoom);

        var groupHistory = d3.values(groups).map(g => (g.charters.map(c => c.periods)));
        var groupHeight = height / (Object.keys(groups).length + 1);
        var flatHistory = groupHistory.reduce((a,b) => a.concat(b), []).reduce((a,b) => a.concat(b), []);
        x.domain(d3.extent(flatHistory, function(d) { return Math.max(new Date().setMonth(new Date().getMonth() - 24), d.start); })).nice();
        var groupEnter = svg.selectAll("g.group").data(d3.values(groups))
            .enter();

        var groupEls = groupEnter
            .append("g")
            .attr("id", d => "g" + d.id)
            .attr("focusable", true)
            .attr("tabIndex", 0)
            .attr("class", "group");
        groupEls
            .insert("foreignObject")
            .attr("width", 350)
            .attr("height", 400)
            .attr("x", 700)
            .attr("y", 170)
            .append("xhtml:div").attr('class','grouppane');


        svg.selectAll("g.group").selectAll("div.grouppane").selectAll("div.charter")
            .data(d => d.charters)
            .enter()
            .append("div")
            .attr("class","charter")
            .append("p")
            .append("a")
            .attr("href", d => d.uri)
            .text((d,i) => "#" + (i + 1) + " charter");
        svg.selectAll("div.charter")
            .append("ul").selectAll("li")
            .data(d=>d.periods)
            .enter()
            .append("li")
            .append("a").attr("href", d => d.cfp ? d.cfp : undefined)
            .text(d => d.duration ? (d.repeat <= 0 ? "chartered on " : "extended on ") + dateFormat(d.start) + " for " + d.duration + " months" : "ending on " + dateFormat(d.start));

        svg.selectAll("g.group").selectAll("g.charter")
            .data(d => d.charters)
            .enter()
            .append("a")
            .attr("xlink:href", function(d)  {return "#g" + d3.select(this.parentNode).datum().id;})
            .attr("title", function(d)  {return "#g" + d3.select(this.parentNode).datum().name;})
            .append("g")
            .attr("class","charter")
            .selectAll("rect")
            .data(d => d.periods)
            .enter()
            .append("rect")
            .attr("y", function(d)  { return Object.keys(groups).indexOf(d3.select(this.parentNode.parentNode.parentNode).datum().id) * groupHeight;})
            .attr("height", groupHeight)
            .style("fill", d => color(cValue(d)))
            .append("title").text(function(d) { return (d.duration === 0 ? "End of charter for " + d.name + " scheduled on " + dateFormat(d.start) : (d.repeat > 0 ? "Extension #" +  d.repeat   : "New charter") + " for " + d3.select(this.parentNode.parentNode.parentNode.parentNode).datum().name + " of " + d.duration + " months"  + " on " + dateFormat(d.start))});

        groupEls
            .append("a")
            .attr("xlink:href", (d,i) => "#g" + Object.keys(groups)[i])
            .append("text")
            .attr("text-anchor", "end")
            .attr("fill", "#333")
            .attr("y", (d,i) => i*groupHeight + 12)
            .text((d,i) => d.name.replace("Working Group", ""));

        svg.append("line")
            .attr("class", "policy")
            .attr("y1", y(0))
            .attr("y2", -5)
            .style("stroke-width", 2)
            .style("stroke", "#FAA");
        svg.append("text")
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
                var x = width + margin.right;
                var y = i * legendRectSize;
                return 'translate(' + x + ',' + y + ')';
            });

        d3.select("g.legendbox")
            .append('foreignObject')
            .attr("width", 320)
            .attr("height", 30)
            .attr("x", width + margin.right)
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
            .attr("value", d => d.id)
            .property("selected", d => location.hash === '#g' + d.id ? 'selected'  : null)
            .text(d => d.name.replace("Working Group", "WG"));

        document.getElementById('groupSelector')
            .addEventListener('change', function(e) {
                location.hash = '#g' + this.options[this.selectedIndex].value;
            });
        window.addEventListener("hashchange", function(e) {
            document.querySelector("option[value='" + location.hash.slice(2) +"']")
                .selected = true;
        });
        
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


        zoom.x(x);
        draw();
        function draw() {
            var now = new Date();
            var months3 = new Date().setMonth(now.getMonth() + 3);
            svg.select("g.x.axis").call(xAxis);
            svg.selectAll("line.policy")
                .attr("x1", x(parseDate("2015-06-18")))
                .attr("x2", x(parseDate("2015-06-18")));
            svg.selectAll("text.policy")
                .attr("x", x(parseDate("2015-06-18")));
            svg.selectAll("line.today")
                .attr("x1", x(now))
                .attr("x2", x(now));
            svg.selectAll("text.today")
                .attr("x", x(now));
            svg.selectAll("line.months3")
                .attr("x1", x(months3))
                .attr("x2", x(months3));
            svg.selectAll("text.months3")
                .attr("x", x(months3));
            svg.selectAll("g.group").selectAll("rect")
                .attr("x", d => x(d.start))
                .attr("width", d => Math.max(0, x(d.end) - x(d.start)))
            svg.selectAll("g.group").selectAll("text")
                .attr("x", d => Math.max(x(d.charters[0].periods[0].start) - 3, 0 - margin.left ))
                .attr("text-anchor", d => x(d.charters[0].periods[0].start) - 3 > 0 - margin.left ? "end" : "start")

        }
    }
});

