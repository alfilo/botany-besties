/*
 * Copyright (c) 2020 Alina Loginov, Alexey Loginov
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

function ContentDisplay(content, idKeys, opts) {

    // Provide default values.  Consider using Proxy in the future.
    if (!("titleKeys" in opts)) opts.titleKeys = idKeys;
    if (!("titleSep" in opts)) opts.titleSep = " ";
    if (!("customFltrMatchers" in opts)) opts.customFltrMatchers = {};
    if (!("newTab" in opts)) opts.newTab = false;
    if (!("trackSelection" in opts)) opts.trackSelection = false;

    // General helper for converting a key value into a valid ID
    function makeId(string) {
        return string.toLowerCase()
            .replace(/[^a-z0-9 ]+/g, '')  // Keep alphanumeric chars and spaces
            .replace(/ /g, '-');  // Replace spaces with dashes
    }
 
    // Return a checker of items against all filters
    function filterMatcherFn(filters) {
        return function (item) {
            // Check item's entries against every filter's selection
            for (var filter in filters) {
                if (filter in opts.customFltrMatchers) {
                    if (!opts.customFltrMatchers[filter](item[filter], filters[filter]))
                        return false;
                } else {
                    var filterLC = filter.toLowerCase();
                    // Values in filters are lowercase
                    if (filter in item && !item[filter].toLowerCase().includes(filters[filter].toLowerCase()) ||
                        filterLC in item && !item[filterLC].toLowerCase().includes(filters[filter].toLowerCase()))
                        return false;  // Any match fails: skip item
                }
            }
            return true;  // Passed all filters: keep item   
        }
    };

    var imgHandlingEnum = Object.freeze({ALL: 1, FIRST: 2, RANDOM: 3});

    // Create image(s) with the src, title, and alt based on item's keys and image
    // tags, if present.  Image tags are used to show multiple images.  Stop after
    // one if the last argument is false.  Return the images as a jQuery object.
    // Use different formats and a default as backup images
    function makeImgs(item, imgHandling = imgHandlingEnum.ALL) {
        window.loadAlternative = function(img) {
            var fallbacks = $(img).data("fallbacks");
            if (fallbacks.length)
                img.src = "images/" + fallbacks.shift();
        }
        function makeImg(id, title) {
            return $("<img>")
                .prop("src", "images/" + id + ".jpg")
                .prop("title", title)
                .prop("alt", title)
                .data("fallbacks", [id + ".png", id + ".svg", "default.jpg", "default.png", "default.svg"])
                .attr("onerror", "loadAlternative(this)");
        }

        var imgOverride = "images" in item ? item["images"] : item["Images"];
        if (imgOverride) {
            // Array of explicit image titles in XML or string to split in CSV
            var imgTitles = typeof imgOverride === "string" ?
                imgOverride.split(':') : imgOverride.image;
            if (imgHandling === imgHandlingEnum.ALL) {
                // Collect results in a jQuery object for use/modification in callers
                var $imgs = $();
                for (var i = 0; i < imgTitles.length; i++) {
                    $imgs = $imgs.add(makeImg(makeId(imgTitles[i]), imgTitles[i]));
                }
                return $imgs;
            } else {
                var idx = imgHandling === imgHandlingEnum.FIRST ? 0 : 
                    new Date().getSeconds() % imgTitles.length;  // RANDOM
                return makeImg(makeId(imgTitles[idx]), imgTitles[idx]);
            }
        } else {  // No image tags--use the idKeys and opts.titleKeys
            var idStr = "";
            for (var i = 0; i < idKeys.length; i++) {
                idStr += item[idKeys[i]] + " ";
            }
            idStr = idStr.slice(0, -1);
            var title = "";
            for (var i = 0; i < opts.titleKeys.length; i++) {
                title += item[opts.titleKeys[i]] + opts.titleSep;
            }
            title = title.slice(0, -opts.titleSep.length);
            return makeImg(makeId(idStr), title);
        }
    }


    function Selection() {
        var arr = [];  // Used only when localStorage not available
        var useWLS = false;  // Updated if test below succeeds
        try {
            // Check for localStorage availability and successful modification
            window.localStorage.setItem("test-key", "test-value");
            window.localStorage.removeItem("test-key");
            useWLS = true;
        } catch (err) {
            console.log("Local storage not available; falling back on an array");
            console.log(err.name + ": " + err.message);
        }

        this.isEmpty = function () {
            if (useWLS) {
                return !window.localStorage.length;
            } else {
                return !arr.length
            }
        }

        this.includes = function (item) {
            if (useWLS) {
                return window.localStorage.getItem(makeWLSKey(item)) !== null;
            } else {
                return arr.includes(item);
            }
        }

        this.array = function () {
            if (useWLS) {
                return $.grep(content, function (item) {
                    return window.localStorage.getItem(makeWLSKey(item)) !== null;
                });
            } else {
                return arr;
            }
        }

        function makeWLSKey(item) {
            var key = "";
            for (var i = 0; i < idKeys.length; i++) {
                key += item[idKeys[i]] + opts.titleSep;
            }
            return key.slice(0, -opts.titleSep.length);
        }

        this.add = function (item) {
            if (useWLS) {
                // Record plant quantity as the value (for now, 1)
                window.localStorage.setItem(makeWLSKey(item), 1);
            } else {
                arr.push(item);
            }
        }

        this.remove = function (item) {
            if (useWLS) {
                window.localStorage.removeItem(makeWLSKey(item));
            } else {
                // Uses strict equality for objects
                var idx = arr.indexOf(item);
                arr.splice(idx, 1);
            }
        }

        this.clear = function () {
            if (useWLS) {
                window.localStorage.clear();
            } else {
                arr = [];
            }
        }
    }

    /* Link creation and helpers */
    this.links = new function Links() {
        var filteredContent = [];
        var selection = new Selection();
        this.makeDetailsHref = function (item) {
            // Build the link with URL search params out of item's idKeys values
            var urlParams = new URLSearchParams();
            if (opts.contentSrc) {
                urlParams.set("src", opts.contentSrc);
            }
            for (var j = 0; j < idKeys.length; j++) {
                urlParams.set(makeId(idKeys[j]), makeId(item[idKeys[j]]));
            }
            return "details.html?" + urlParams.toString();
        }

        this.makeItemTitle = function (item) {
            var title = "";
            for (var j = 0; j < opts.titleKeys.length; j++) {
                title += item[opts.titleKeys[j]] + opts.titleSep;
            }
            return title.slice(0, -opts.titleSep.length);
        }

        this.makeDetailsLink = function (item) {
            return $("<a>").prop("href", this.makeDetailsHref(item))
                .prop("target", opts.newTab ? "_blank" : "_self")
                .text(this.makeItemTitle(item));
        }

        this.clearSelect = function () {
            selection.clear();
            $("#filter-results input:checkbox:checked").prop("checked", false);
            if ("selectionCallback" in opts && filteredContent.length) {
                opts.selectionCallback(filteredContent);
            }
        }

        this.selectAll = function () {
            for (var i = 0; i < filteredContent.length; i++) {
                if (!selection.includes(filteredContent[i])) {
                    selection.add(filteredContent[i]);
                }
            }
            $("#filter-results input:checkbox:not(:checked)").prop("checked", true);
            if ("selectionCallback" in opts && !selection.isEmpty() ) {
                opts.selectionCallback(selection.array());
            }
        }

        // Fill in DOM links for all items in content
        for (var i = 0; i < content.length; i++) {
            content[i].link = this.makeDetailsLink(content[i])[0];
        }

        /* Generate links for content items and add to list.
           Invoke callback, if present (e.g., visualization).
         */
        this.generate = function (list, filters = {}) {
            filteredContent = $.grep(content, filterMatcherFn(filters));
            for (var i = 0; i < filteredContent.length; i++) {
                var item = filteredContent[i];
                var li = $("<li>").appendTo(list);
                if (opts.trackSelection) {
                    var checkbox = $("<input>")
                        .attr("type", "checkbox")
                        .attr("name", "vis-select")
                        .attr("value", this.makeItemTitle(item))
                        .prop("checked", selection.includes(item));
                    li.append(checkbox)
                        .append($("<label>").append(item.link));

                    checkbox.click((function () {
                        var thisItem = item;
                        return function () {
                            if (this.checked) {
                                selection.add(thisItem);
                            } else {
                                selection.remove(thisItem);
                            }
                            if ("selectionCallback" in opts) {
                                opts.selectionCallback(selection.isEmpty() ?
                                    filteredContent : selection.array());
                            }
                        }
                    })());

                } else {
                    li.append(item.link);
                }
            }

            if ("selectionCallback" in opts) {
                if (opts.trackSelection && !selection.isEmpty()) {
                    opts.selectionCallback(selection.array());
                } else {
                    opts.selectionCallback(filteredContent);
                }
            }
        }
    }

    // Save property in a variable for local use
    var links = this.links;


    /* Details page and related functions */
    this.details = new function Details() {
        // Convert key (coming from an XML tag) into a heading
        function makeHeading(key) {
            // Upper-case the first character
            return (key.charAt(0).toUpperCase() + key.slice(1))
                .replace(/-/g, ' ');  // Replace dashes with spaces
        }

        // Recursively display the object and all its values; start at heading level 3
        function displayObject(obj, $parent, hLevel = 3) {
            for (var prop in obj) {
                if (prop.toLowerCase() === "images" || prop.toLowerCase() === "link")
                    continue;  // Ignore the images and links here
                // Skip over tags w/o details or those used in the id or the title
                if (obj[prop] && !idKeys.includes(prop) && !opts.titleKeys.includes(prop)) {
                    if (typeof obj[prop] === "string") {
                        $parent
                            // Make a heading out of prop
                            .append($("<h" + hLevel + ">").text(makeHeading(prop)))
                            // Make a paragraph out of prop's value in obj
                            .append($("<p>").text(obj[prop]));
                    } else if (Array.isArray(obj[prop])) {
                        // Don't make a heading out of prop for arrays
                        // It's usually duplicative of the prop higher up
                        displayArray(obj[prop], $parent, hLevel);
                    } else {
                        if (prop === "html") {
                            // Translate json back to XML and insert (as HTML)
                            $parent.append(opts.x2js.json2xml_str(obj[prop]));
                        } else {
                            $parent
                                // Make a heading out of prop
                                .append($("<h" + hLevel + ">").text(makeHeading(prop)));
                            // Recursively display the object that is prop's value in obj
                            displayObject(obj[prop], $parent, hLevel + 1);
                        }
                    }
                }
            }
        }

        // Recursively display the array and all its elements
        function displayArray(arr, $parent, hLevel) {
            var $ol = $("<ol>").appendTo($parent);
            for (var i = 0; i < arr.length; i++) {
                var $li = $("<li>").appendTo($ol);
                if (typeof arr[i] === "string") {
                    $li.text(arr[i]);  // String: list item
                } else if (Array.isArray(arr[i])) {
                    // Recursively display the array in arr[i]
                    displayArray(arr[i], $li, hLevel);
                } else {
                    // Recursively display the object at arr[i]
                    displayObject(arr[i], $li, hLevel);
                }
            }
        }

        function generateTable(itemInfo) {
            // Fill in the table (assumes a flat object, like from a CSV file)
            var $tbody = $(".main tbody");
            for (var prop in itemInfo) {
                if (prop.toLowerCase() === "images" || prop.toLowerCase() === "link")
                    continue;  // Ignore the images and links here
                // Skip over tags w/o details or those used in the id or the title
                if (itemInfo[prop] && !idKeys.includes(prop) && !opts.titleKeys.includes(prop)) {
                    $("<tr>")
                        .append($("<td>").text(prop))
                        .append($("<td>").text(itemInfo[prop]))
                        .appendTo($tbody);
                }
            }
        }

        this.generate = function (makeTable = false) {
            // Find the item requested by search params
            var urlParams = new URLSearchParams(location.search);
            var itemInfo;  // Save the matching object in itemInfo
            contentLoop: for (var i = 0; i < content.length; i++) {
                for (var j = 0; j < idKeys.length; j++) {
                    var requestedId = urlParams.get(makeId(idKeys[j]));
                    if (makeId(content[i][idKeys[j]]) !== requestedId) {
                        continue contentLoop;  // A key mismatch, go to next item
                    }
                }
                itemInfo = content[i];
                break;
            }

            // Make heading out of the displayed item's keys
            $("#header h1").text(links.makeItemTitle(itemInfo));

            if (makeTable) {
                generateTable(itemInfo);
            } else {
                // Fill in the page: recursively display itemInfo
                displayObject(itemInfo, $(".column.main"));
            }
            // Make image(s) in the right column
            makeImgs(itemInfo).appendTo($(".column.right"));
        }
    }


    /* Search with autocomplete and related functions */
    this.search = new function Search() {
        // Return true if match succeeds in this object or recursively in values
        function matchInObject(obj, matcher, searchKeys) {
            for (var prop in obj) {
                if (prop.toLowerCase() === "images" || prop.toLowerCase() === "link")
                    continue;  // Ignore the images and links here
                // Skip over non-search keys and tags w/o details
                if ((!searchKeys.length || searchKeys.includes(prop)) && obj[prop]) {
                    if (typeof obj[prop] === "string") {
                        if (matcher.test(obj[prop])) {
                            return true;
                        }
                    } else if (Array.isArray(obj[prop])) {
                        if (matchInArray(obj[prop], matcher, searchKeys)) {
                            return true;
                        }
                    } else {
                        if (matchInObject(obj[prop], matcher, searchKeys)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        // Return true if match succeeds in this array or recursively in elements
        function matchInArray(arr, matcher, searchKeys) {
            for (var i = 0; i < arr.length; i++) {
                if (typeof arr[i] === "string") {
                    if (matcher.test(arr[i])) {
                        return true;
                    }
                } else if (Array.isArray(arr[i])) {
                    if (matchInArray(arr[i], matcher, searchKeys)) {
                        return true;
                    }
                } else {
                    if (matchInObject(arr[i], matcher, searchKeys)) {
                        return true;
                    }
                }
            }
            return false;
        }

        this.configureSearch = function (column = "right", staticFilters = {}, dynFltrNames = [], searchKeys = []) {
            $("#search-" + column).autocomplete({
                source: function (request, response) {
                    var filters = Object.assign({}, staticFilters);
                    for (var i = 0; i < dynFltrNames.length; i++) {
                        var dynFltrVal = $("#search-" + makeId(dynFltrNames[i])).val();
                        filters[dynFltrNames[i]] = dynFltrVal;
                    }
                    // Only match the typed text at the start of words
                    var pattern = "\\b" + $.ui.autocomplete.escapeRegex(request.term);
                    var matcher = new RegExp(pattern, "i");
                    var filterMatcher = filterMatcherFn(filters);
                    response($.grep(content, function (item) {
                        // Look for the matching text throughout the object
                        return filterMatcher(item) && matchInObject(item, matcher, searchKeys);
                    }));
                },
                minLength: 0,
                focus: function (event, ui) {
                    // Pop up the focused element's image
                    $(".search-img").hide();
                    $(".column." + column + " img").hide();
                    var searchPos = $("#search-" + column).position();
                    makeImgs(ui.item, imgHandlingEnum.RANDOM)
                        .addClass("search-img")
                        // Place the image in line with search box and below the cursor
                        .css({
                            "left": searchPos.left + "px",
                            "top": (event.clientY + 30) + "px"
                        })
                        .appendTo($(document.body));
                },
                close: function (event, ui) {
                    // Hide the image triggered by focus
                    $(".search-img").hide();
                    $(".column." + column + " img").show();
                },
                select: function (event, ui) {
                    if (opts.newTab) {
                        // Not blocked as a popup because it's caused by a user action
                        window.open(links.makeDetailsHref(ui.item), "_blank");
                    } else {
                        // Setting location and location.href has the same effect, if
                        // location isn't set.  Both act as if the link is clicked, so
                        // "Back" goes to current page).  location.replace(url) is like
                        // HTTP redirect--it skips the current page for back navigation.
                        // $(location).prop('href', url) is the jQuery way but it's not
                        // an improvement over the below.

                        // Navigate to the selected item
                        location.href = links.makeDetailsHref(ui.item);
                    }
                }
            }).autocomplete("instance")._renderItem = function (ul, item) {
                return $("<li>")
                    .append("<div><i>" + links.makeItemTitle(item) + "</i>" + "</div>")
                    .appendTo(ul);
            };
        }

    }


    /* Category view (image with links on hover) in main column */
    this.categoryView = new function CategoryView() {
        this.generate = function () {
            var $mainColumn = $(".column.main");
            for (var i = 0; i < content.length; i++) {
                var category = "category" in content[i] ?
                    content[i]["category"] : content[i]["Category"];
                var categoryId = makeId(category);
                var $categoryUl = $('#' + categoryId);
                // If we haven't seen this category yet, create an image of this item
                // and pop-up text (header & link list)
                if (!$categoryUl.length) {
                    $categoryUl = $("<ul>").attr("id", categoryId);
                    // Make only one image
                    var $img = makeImgs(content[i], imgHandlingEnum.FIRST)
                        .addClass("cat-img");
                    $("<div>").addClass("cat-div")
                        .append($img)
                        .append($("<div>").addClass("cat-text")
                            .append($("<h4>").text(category))
                            .append($categoryUl))
                        .appendTo($mainColumn);
                }
                // Make link for the item and add to the category list
                var link = links.makeDetailsLink(content[i]);
                $("<li>").append(link).appendTo($categoryUl);
            }
        }
    }


    /* Dated activities as links in the right column */
    this.activities = new function Activities() {
        // Construct Date object out of item for comparisons
        function makeDate(item) {
            var stringDate = item["month"] + " " + item["day"] + " " + item["year"];
            return new Date(stringDate);
        }

        // Set up link to next activity in right column:
        // find content item with the closest date in the future and
        // make a link to it in the right column
        this.generateNextActivity = function () {
            var nextActivityInfo;
            var today = new Date();
            for (var i = 0; i < content.length; i++) {
                var iDate = makeDate(content[i]);
                if (iDate > today) {
                    if (nextActivityInfo == null) {
                        nextActivityInfo = content[i];
                        continue;
                    }
                    var nextActivityDate = makeDate(nextActivityInfo);
                    if (iDate < nextActivityDate) {
                        nextActivityInfo = content[i];
                    }
                }
            }
            if (nextActivityInfo)
                links.makeDetailsLink(nextActivityInfo).appendTo($(".column.right"));
        }
    }


    /* Dropdown filters */
    this.filters = new function Filters() {
        // Tracks the current filter selections {feature: detail, ...}
        var curFilters = {};

        this.clearFilters = function (button) {
            curFilters = {};  // Remove all filter settings
            // Clear selected style for all filter buttons
            $("#filter-group").find(".selected").removeClass("selected");
            $(button).hide();  // Hide the clear-all-filters button

            // Empty the list of matching items and make links for all items
            var $frUl = $("#filter-results").empty();
            links.generate($frUl, {});
        }

        this.updateFilter = function (clickBtn) {
            // Get the value for filter (in this node) and the filter
            // (in grandparent's first element child)
            var value = clickBtn.textContent.toLowerCase();
            var filterBtn = clickBtn.parentNode.parentNode.firstElementChild;
            var filter = filterBtn.textContent;

            // Clear selected style in buttons of this filter's dropdown-content
            // (in case there was a selection in this filter before)
            $(clickBtn.parentNode).find(".selected").removeClass("selected");

            if (curFilters[filter] === value) {
                // Same setting for filter clicked: delete from current
                // filters and clear selected style for filter button
                delete curFilters[filter];
                $(filterBtn).removeClass("selected");
            } else {
                // New or different setting for filter: update current filters
                // and add selected style to the value and filter buttons
                curFilters[filter] = value;
                $(clickBtn).addClass("selected");
                $(filterBtn).addClass("selected");
            }

            // Hide the clear-all-filters button, if no filter is set; otherwise show
            if ($.isEmptyObject(curFilters)) {
                $("#clear-filters").hide();
            } else {
                $("#clear-filters").show();
            }

            // Empty the list of matching items and make links for matching items
            var $frUl = $("#filter-results").empty();
            links.generate($frUl, curFilters);
        };
    }
}
