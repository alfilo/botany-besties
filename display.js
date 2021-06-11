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
  if (!("catCol" in opts)) opts.catCol = "main";
  if (!("detailCol" in opts)) opts.detailCol = "main";
  if (!("imgCol" in opts)) opts.imgCol = "side";
  if (!("eventCol" in opts)) opts.eventCol = "side";
  if (!("customFltrMatchers" in opts)) opts.customFltrMatchers = {};
  if (!("ignoreCats" in opts)) opts.ignoreCats = [];
  if (!("dropdownCat" in opts)) opts.dropdownCat = false;
  if (!("detailTable" in opts)) opts.detailTable = false;
  if (!("newTab" in opts)) opts.newTab = false;
  if (!("trackSelection" in opts)) opts.trackSelection = false;

  // General helper for converting a key value into a valid ID
  function makeId(string) {
    return string
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, "") // Keep alphanumeric chars and spaces
      .replace(/ /g, "-"); // Replace spaces with dashes
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
          if (
            (filter in item &&
              !item[filter]
                .toLowerCase()
                .includes(filters[filter].toLowerCase())) ||
            (filterLC in item &&
              !item[filterLC]
                .toLowerCase()
                .includes(filters[filter].toLowerCase()))
          )
            return false; // Any match fails: skip item
        }
      }
      return true; // Passed all filters: keep item
    };
  }

  var imgHandlingEnum = Object.freeze({ ALL: 1, FIRST: 2, RANDOM: 3 });

  // Create image(s) with the src, title, and alt based on item's keys and image
  // tags, if present.  Image tags are used to show multiple images.  Stop after
  // one if the last argument is false.  Return the images as a jQuery object.
  // Use different formats and a default as backup images
  function makeImgs(item, imgHandling = imgHandlingEnum.ALL) {
    window.loadAlternative = function (img) {
      var fallbacks = $(img).data("fallbacks");
      if (fallbacks.length) img.src = "images/" + fallbacks.shift();
    };
    function makeImg(id, title) {
      return $("<img>")
        .prop("src", "images/" + id + ".jpg")
        .prop("title", title)
        .prop("alt", title)
        .data("fallbacks", [
          id + ".png",
          id + ".svg",
          "default.jpg",
          "default.png",
          "default.svg",
        ])
        .attr("onerror", "loadAlternative(this)");
    }

    var imgOverride = "images" in item ? item["images"] : item["Images"];
    if (imgOverride) {
      // Array of explicit image titles in XML or string to split in CSV
      var imgTitles =
        typeof imgOverride === "string"
          ? imgOverride.split(":")
          : typeof imgOverride.image === "string"
          ? // Handle the case of a single image (prettier removed nesting!)
            [imgOverride.image]
          : imgOverride.image;
      if (imgHandling === imgHandlingEnum.ALL) {
        // Collect results in a jQuery object for use/modification in callers
        var $imgs = $();
        for (var i = 0; i < imgTitles.length; i++) {
          $imgs = $imgs.add(makeImg(makeId(imgTitles[i]), imgTitles[i]));
        }
        return $imgs;
      } else {
        var idx =
          imgHandling === imgHandlingEnum.FIRST
            ? 0
            : new Date().getSeconds() % imgTitles.length; // RANDOM
        return makeImg(makeId(imgTitles[idx]), imgTitles[idx]);
      }
    } else {
      // No image tags--use the idKeys and opts.titleKeys
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
    var arr = []; // Used only when localStorage not available
    var useWLS = false; // Updated if test below succeeds
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
        return !arr.length;
      }
    };

    this.includes = function (item) {
      if (useWLS) {
        return window.localStorage.getItem(makeWLSKey(item)) !== null;
      } else {
        return arr.includes(item);
      }
    };

    this.array = function () {
      if (useWLS) {
        return $.grep(content, function (item) {
          return window.localStorage.getItem(makeWLSKey(item)) !== null;
        });
      } else {
        return arr;
      }
    };

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
    };

    this.remove = function (item) {
      if (useWLS) {
        window.localStorage.removeItem(makeWLSKey(item));
      } else {
        // Uses strict equality for objects
        var idx = arr.indexOf(item);
        arr.splice(idx, 1);
      }
    };

    this.clear = function () {
      if (useWLS) {
        window.localStorage.clear();
      } else {
        arr = [];
      }
    };
  }

  /* Link creation and helpers */
  this.links = new (function Links() {
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
    };

    this.makeItemTitle = function (item) {
      var title = "";
      for (var j = 0; j < opts.titleKeys.length; j++) {
        title += item[opts.titleKeys[j]] + opts.titleSep;
      }
      return title.slice(0, -opts.titleSep.length);
    };

    this.makeDetailsLink = function (item) {
      return $("<a>")
        .prop("href", this.makeDetailsHref(item))
        .prop("target", opts.newTab ? "_blank" : "_self")
        .text(this.makeItemTitle(item));
    };

    this.makeCategoryHref = function (category, catPathIds) {
      // Build the link with URL search params recording catPathIds
      var urlParams = new URLSearchParams();
      if (opts.contentSrc) {
        urlParams.set("src", opts.contentSrc);
      }
      // Extend catPathIds with curent category's ID
      catPathIds = catPathIds.concat(makeId(category));
      for (var j = 0; j < catPathIds.length; j++) {
        urlParams.append("cat", catPathIds[j]);
      }
      // Use contentSrc to make href with new params
      return opts.contentSrc + ".html?" + urlParams.toString();
    };

    this.makeCategoryLink = function (category, catPathIds) {
      return $("<a>")
        .prop("href", this.makeCategoryHref(category, catPathIds))
        .prop("target", opts.newTab ? "_blank" : "_self")
        .text(category);
    };

    this.clearSelect = function () {
      selection.clear();
      $("#filter-results input:checkbox:checked").prop("checked", false);
      if ("selectionCallback" in opts && filteredContent.length) {
        opts.selectionCallback(filteredContent);
      }
    };

    this.selectAll = function () {
      for (var i = 0; i < filteredContent.length; i++) {
        if (!selection.includes(filteredContent[i])) {
          selection.add(filteredContent[i]);
        }
      }
      $("#filter-results input:checkbox:not(:checked)").prop("checked", true);
      if ("selectionCallback" in opts && !selection.isEmpty()) {
        opts.selectionCallback(selection.array());
      }
    };

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
          li.append(checkbox).append($("<label>").append(item.link));

          checkbox.click(
            (function () {
              var thisItem = item;
              return function () {
                if (this.checked) {
                  selection.add(thisItem);
                } else {
                  selection.remove(thisItem);
                }
                if ("selectionCallback" in opts) {
                  opts.selectionCallback(
                    selection.isEmpty() ? filteredContent : selection.array()
                  );
                }
              };
            })()
          );
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
    };
  })();

  // Save property in a variable for local use
  var links = this.links;

  /* Details page and related functions */
  this.details = new (function Details() {
    // Convert key (coming from an XML tag) into a heading
    function makeHeading(key) {
      // Upper-case the first character; replace dashes with spaces
      return (key.charAt(0).toUpperCase() + key.slice(1)).replace(/-/g, " ");
    }

    // Recursively display the object and all its values; start at heading level 3
    function displayObject(obj, $parent, hLevel = 3) {
      for (var prop in obj) {
        if (
          prop.toLowerCase() === "images" ||
          prop.toLowerCase() === "link" ||
          prop.toLowerCase() === "category" ||
          prop.toLowerCase() === "dates"
        )
          continue; // Ignore the images and links here
        // Skip over tags w/o details or those used in the id or the title
        if (
          obj[prop] &&
          !idKeys.includes(prop) &&
          !opts.titleKeys.includes(prop)
        ) {
          if (typeof obj[prop] === "string") {
            $parent
              // Make a heading out of prop
              .append($("<h" + hLevel + ">").text(makeHeading(prop)))
              // Make a paragraph out of prop's value in obj
              .append($("<p>").text(obj[prop]));
          } else if (Array.isArray(obj[prop])) {
            if (prop.toLowerCase() === "when") {
              $parent.append($("<h" + hLevel + ">").text("When"));
            }
            // Don't make a heading out of other props for arrays
            // It's usually duplicative of the prop higher up
            displayArray(obj[prop], $parent, hLevel);
          } else {
            if (prop.toLowerCase() === "html") {
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
          $li.text(arr[i]); // String: list item
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
          continue; // Ignore the images and links here
        // Skip over tags w/o details or those used in the id or the title
        if (
          itemInfo[prop] &&
          !idKeys.includes(prop) &&
          !opts.titleKeys.includes(prop)
        ) {
          $("<tr>")
            .append($("<td>").text(prop))
            .append($("<td>").text(itemInfo[prop]))
            .appendTo($tbody);
        }
      }
    }

    this.generate = function () {
      // Find the item requested by search params
      var urlParams = new URLSearchParams(location.search);
      var itemInfo; // Save the matching object in itemInfo
      contentLoop: for (var i = 0; i < content.length; i++) {
        for (var j = 0; j < idKeys.length; j++) {
          var requestedId = urlParams.get(makeId(idKeys[j]));
          if (makeId(content[i][idKeys[j]]) !== requestedId) {
            continue contentLoop; // A key mismatch, go to next item
          }
        }
        itemInfo = content[i];
        break;
      }

      // Make heading out of the displayed item's keys
      $("#header h1").text(links.makeItemTitle(itemInfo));

      if (opts.detailTable) {
        generateTable(itemInfo);
      } else {
        // Fill in the page: recursively display itemInfo
        displayObject(itemInfo, $(".column." + opts.detailCol));
      }
      makeImgs(itemInfo).appendTo($(".column." + opts.imgCol));
    };
  })();

  /* Search with autocomplete and related functions */
  this.search = new (function Search() {
    // Return true if match succeeds in this object or recursively in values
    function matchInObject(obj, matcher, searchKeys) {
      for (var prop in obj) {
        if (prop.toLowerCase() === "images" || prop.toLowerCase() === "link")
          continue; // Ignore the images and links here
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

    this.configureSearch = function (
      column = "side",
      staticFilters = {},
      dynFltrNames = [],
      searchKeys = []
    ) {
      $("#search-" + column)
        .autocomplete({
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
            response(
              $.grep(content, function (item) {
                // Look for the matching text throughout the object
                return (
                  filterMatcher(item) &&
                  matchInObject(item, matcher, searchKeys)
                );
              })
            );
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
                left: searchPos.left + "px",
                top: event.clientY + 30 + "px",
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
          },
        })
        .autocomplete("instance")._renderItem = function (ul, item) {
        return $("<li>")
          .append("<div><i>" + links.makeItemTitle(item) + "</i>" + "</div>")
          .appendTo(ul);
      };
    };
  })();

  /* Category handling (topnav category listing and category view) */
  this.categories = new (function Categories() {
    // Save category path specified so far and make a string version for
    // easy prefix comparison
    var urlParams = new URLSearchParams(location.search);
    var reqCatPath = urlParams.getAll("cat");
    var reqCatPathStr = reqCatPath.join("/");

    function getCatPaths(idx) {
      var catPaths =
        "category" in content[idx]
          ? content[idx]["category"]
          : content[idx]["Category"];
      // Handle one or more category paths in current item
      if (!Array.isArray(catPaths)) {
        catPaths = [catPaths]; // Turn into singleton array
      }
      return catPaths;
    }

    /* Make dropdown list of top-level categories under "catHolder"
           ignoring any categories in opts.ignoreCats */
    this.generateTopnavCats = function () {
      var cats = []; // Stores top level categories
      var $catHolder = $("#topnav-cat-holder");
      for (var i = 0; i < content.length; i++) {
        var catPaths = getCatPaths(i);

        for (var j = 0; j < catPaths.length; j++) {
          // Make an array of category elements
          var catPath = catPaths[j].split("/");
          if (
            !cats.includes(catPath[0]) &&
            !opts.ignoreCats.includes(catPath[0])
          ) {
            cats.push(catPath[0]);
          }
        }
      }
      cats.sort(); // List categories in alphabetic order
      for (var i = 0; i < cats.length; i++) {
        // Only showing top-level links, thus empty required cat path
        $catHolder.append(links.makeCategoryLink(cats[i], []));
      }
    };

    /* Generate category view (image with links on hover) in catCol
           ignoring any categories in opts.ignoreCats */
    this.generateCatView = function () {
      // Stores nextCat links already created for a curCat
      var nextCatMap = {};
      var $col = $(".column." + opts.catCol);
      for (var i = 0; i < content.length; i++) {
        var catPaths = getCatPaths(i);

        // Check if at least one item catPath extends reqCatPath
        catPathsLoop: for (var j = 0; j < catPaths.length; j++) {
          // Make arrays of original category elements and their ID
          // versions for the current catPath; make a string version
          // for easy prefix comparison
          var catPath = catPaths[j].split("/");
          var catPathIds = catPath.map(function (elt) {
            return makeId(elt);
          });
          var catPathStr = catPathIds.join("/");

          // If reqCatPathStr isn't a prefix of catPathStr,
          // this path isn't a match for the request
          if (!catPathStr.startsWith(reqCatPathStr)) continue;
          for (var k = 0; k < catPath.length; k++) {
            if (opts.ignoreCats.includes(catPath[k])) {
              continue catPathsLoop;
            }
          }

          // The current category is the catPath element just past
          // reqCatPath, unless the paths are the same; then take
          // make a category list/image for the last element
          var idx =
            catPath.length > reqCatPath.length
              ? reqCatPath.length
              : reqCatPath.length - 1;
          var curCat = catPath[idx];
          var curCatId = catPathIds[idx];

          var $catHolder = $("#" + curCatId);
          // If we haven't processed this category yet, create a
          // description, link holder, and image for this item
          if (!$catHolder.length) {
            // Initialize the tracker for curCat's nextCat entries
            nextCatMap[curCat] = [];

            var $catDiv = $("<div>").addClass("cat-div").appendTo($col);
            $catHolder = opts.dropdownCat
              ? $("<div>").addClass("dropdown-content")
              : $("<ul>");
            $catHolder.attr("id", curCatId);
            // Make only one image
            var $img = makeImgs(content[i], imgHandlingEnum.FIRST).addClass(
              "cat-img"
            );
            if (opts.dropdownCat) {
              $("<div>")
                .addClass("button-group dropdown")
                .append(
                  $("<button>") // Category name
                    .attr("type", "button")
                    .text(curCat)
                )
                .append($catHolder)
                .appendTo($catDiv);
              $catDiv.append($img);
            } else {
              $catDiv
                .append($img)
                .append(
                  $("<div>")
                    .addClass("cat-text")
                    .append($("<h4>").text(curCat))
                    .append($catHolder)
                );
            }
          }

          // Is there another category (after curCat) in catPath?
          if (catPath.length > reqCatPath.length + 1) {
            var nextCat = catPath[reqCatPath.length + 1];
            // Skip if it's already included in curCat's links
            if (!nextCatMap[curCat].includes(nextCat)) {
              nextCatMap[curCat].push(nextCat);
              // Make link for the next category, with
              // reqCatPath + curCatId as initial catPathIds
              var link = links.makeCategoryLink(
                nextCat,
                reqCatPath.concat(curCatId)
              );
              $catHolder.append(
                opts.dropdownCat ? link : $("<li>").append(link)
              );
            }
          } else {
            // Make regular details link for the item and add to
            // the category list
            var link = links.makeDetailsLink(content[i]);
            $catHolder.append(opts.dropdownCat ? link : $("<li>").append(link));
          }
        }
      }
    };
  })();

  /* Events (with dates and, optionally, times) */
  this.events = new (function Events() {
    // Construct Date object out of item for comparisons
    function setDates(item) {
      var dateStrs = [];
      if ("when" in item) {
        dateStrs = typeof item.when === "string" ? [item.when] : item.when;
      } else if ("month" in item && "day" in item && "year" in item) {
        dateStrs = [item.month + " " + item.day + " " + item.year];
      }
      if (!dateStrs.length) return false;

      var dates = [];
      for (var i = 0; i < dateStrs.length; i++) {
        var date = new Date(dateStrs[i]);
        if (isNaN(date)) {
          console.error("Invalid date string " + dateStrs[i]);
        } else {
          dates.push(date);
        }
      }
      if (dates.length) {
        item.dates = dates;
        return true;
      }
      return false;
    }

    // Set up links to upcoming events: find content items with dates
    // in the future and group by day as lists in eventCol
    this.generateUpcomingEvents = function () {
      var now = new Date();
      // Collect tuples of items paired with each of their dates
      var events = content.reduce(function (accum, item) {
        if (setDates(item)) {
          for (var i = 0; i < item.dates.length; i++) {
            if (item.dates[i] > now) {
              accum.push({ item: item, date: item.dates[i] });
            }
          }
        }
        return accum;
      }, []);
      events.sort(function (a, b) {
        return a.date - b.date;
      });
      var $col = $(".column." + opts.eventCol);
      var curDs = "";
      var $ul;
      for (var i = 0; i < events.length; i++) {
        var ds = events[i].date.toDateString();
        // Group time and event info by date
        if (ds !== curDs) {
          $ul = $("<ul>");
          curDs = ds;
          $col.append($("<h4>").text(ds)).append($ul);
        }
        // Use Hours, Minutes, and AM/PM
        var ts = events[i].date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
        });
        var $link = links.makeDetailsLink(events[i].item);
        $("<li>")
          .append(ts + ": ")
          .append($link)
          .appendTo($ul);
      }
    };

    // Set up link to next event: find content item with the closest date
    // in the future and make a link to it in eventCol
    this.generateNextEvent = function () {
      var nextEventDate,
        nextEventInfo = null;
      var now = new Date();
      for (var i = 0; i < content.length; i++) {
        if (!setDates(content[i])) continue;

        var dates = content[i].dates;
        for (var j = 0; j < dates.length; j++) {
          if (
            dates[j] > now &&
            (nextEventInfo === null || dates[j] < nextEventDate)
          ) {
            nextEventDate = dates[j];
            nextEventInfo = content[i];
          }
        }
      }
      if (nextEventInfo)
        links
          .makeDetailsLink(nextEventInfo)
          .appendTo($(".column." + opts.eventCol));
    };
  })();

  /* Dropdown filters */
  this.filters = new (function Filters() {
    // Tracks the current filter selections {feature: detail, ...}
    var curFilters = {};

    this.clearFilters = function (button) {
      curFilters = {}; // Remove all filter settings
      // Clear selected style for all filter buttons
      $("#filter-group").find(".selected").removeClass("selected");
      $(button).hide(); // Hide the clear-all-filters button

      // Empty the list of matching items and make links for all items
      var $frUl = $("#filter-results").empty();
      links.generate($frUl, {});
    };

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
  })();
}
