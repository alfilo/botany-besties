"use strict";

/* Process XML file's content and call appropriate generation routines */

function handleXMLContent() {
    // Save names of data files and keys used for identifying items
    // For details pages, look up src param
    var content;  // The content from the XML file
    var idKeys;  // The keys used for identifying an item (vary by page)
    var contentSrc = "";  // Value for src param, e.g., "meetings"

    if (location.search) {
        var urlParams = new URLSearchParams(location.search);
        contentSrc = urlParams.get("src");
    }
    if (location.pathname.includes("meetings.html") || contentSrc === "meetings") {
        var fileName = "data/meetings.xml";
        idKeys = ["month", "day", "year"];
        contentSrc = "meetings";
    } else if (location.pathname.includes("gardens.html") || contentSrc === "gardens") {
        var fileName = "data/gardens.xml";
        idKeys = ["name"];
        contentSrc = "gardens";
    } else if (location.pathname.includes("recipes.html") || contentSrc === "recipes") {
        var fileName = "data/recipes.xml";
        idKeys = ["name"];
        contentSrc = "recipes";
    } else if (location.pathname.includes("resources.html") || contentSrc === "resources") {
        var fileName = "data/resources.xml";
        idKeys = ["kind", "name"];
        contentSrc = "resources";
    }
    $.get(fileName, function(xml) {
        // Convert XML to JSON to allow grepping, etc.
        var x2js = new X2JS();
        var jsObj = x2js.xml2json(xml);
        // Dereference into the first field (such as .meetings)
        jsObj = jsObj[Object.keys(jsObj)[0]];
        // Dereference into the second field (such as .meeting)
        content = jsObj[Object.keys(jsObj)[0]];

        var contentDisplay = new ContentDisplay(content, idKeys,
            { contentSrc: contentSrc, x2js: x2js });

        // If the location includes a search entry, we're customizing the
        // details page for the requested item (e.g., meeting-details.html);
        // otherwise,we're setting up the top-level page (e.g., meetings.html)
        if (location.search) {
            contentDisplay.details.generate();
        } else if (location.pathname.includes("gardens.html")) {
            // Set up basic (complete) list of links
            var $ul = $("<ul>").appendTo($(".column.main"));
            contentDisplay.links.generate($ul);
        } else if (location.pathname.includes("recipes.html")) {
            // Create category images that show links on hover
            contentDisplay.categories.generateCatView();

            // Configure autocomplete-based search
            contentDisplay.search.configureSearch();
        } else if (location.pathname.includes("resources.html")) {
            // Configure autocomplete-based search for Topics in main column
            contentDisplay.search.configureSearch("main", {"kind" : "Topic:"});

            // Configure autocomplete-based search for Warmups in side column
            contentDisplay.search.configureSearch("side", {"kind" : "Warmup:"});
        } else {  // meetings.html
            // Set up filters for selecting specific meetings by content
            // Register on-click listener for filter selections
            $("#filter-group .dropdown-content button").click(function () {
                contentDisplay.filters.updateFilter(this);
            });
            // Register on-click listener for clear-all-filters
            var $cf = $("#clear-filters").click(function () {
                contentDisplay.filters.clearFilters(this);
            });
            $cf.hide();  // hide the clear-all-filters button initially
            // Click on the latest value in the last dropdown (current year)
            // This is the first button under dropdown-content of the last div
            // (a dropdown) under filter-group
            $("#filter-group div:last-of-type .dropdown-content button:first-child").click();

            // Generate the next meeting's link in the side column
            contentDisplay.events.generateNextEvent();
        }
    });
}

$(function() {  // Call this from DOM's .ready()
    // Define header, topnav, and footer in one place (load.html) and
    // reuse them for every page (for consistency and easier updates)
    var placeholders = ["#header", "#topnav", "#footer"];
    for (var i = 0; i < placeholders.length; i++) {
        var sharedEltUrl = "load.html " + placeholders[i] + "-shared";
        // Call handleXML for all pages listed below.
        // Do this after the header load is completed because
        // the header is the only loaded element that may be updated
        if (i == 0 && (location.pathname.includes("meetings.html") ||
                       location.pathname.includes("gardens.html") ||
                       location.pathname.includes("recipes.html") ||
                       location.pathname.includes("resources.html") ||
                       location.pathname.includes("details.html"))) {
            $(placeholders[i]).load(sharedEltUrl, handleXMLContent);
        } else {
            $(placeholders[i]).load(sharedEltUrl);
        }
    }
    if (location.pathname.includes("faq") ||
        location.pathname.includes("contact")) {
        // Register slideToggle for buttons on FAQ and contact pages
        var $slideBtn = $(".slide-down-btn");
        $slideBtn.click(function() {
            $(this).next().slideToggle();
        });
    }
});
