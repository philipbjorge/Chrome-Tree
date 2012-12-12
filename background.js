function l(s) {
    console.log(s);
}

function hash(s) {
    var hash = 0;
    if (s.length == 0) return hash;
    for (i = 0; i < s.length; i++) {
        char = s.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

//
// Tree Operations
// theTree contains our nested undo/redo tree
// theTabId keeps track of which tabId (or root id) we should display
// whichNodeKey is a map from theTabId to the currently selected node
//
theTree = {};
whichNodeKey = {}; // a map from tabId to currentNodeKey
theTabId = "";
ignoreStateChange = ""; // Used when we want to ignore a URL (temporarily)

function node(title, url, id, children) {
    var node = {title: title, url: url, key: id, children: children, icon: null};
    return node;
}
//
// End Tree Operations
//

//
// UI Operations
//
function getTree() {
    var tree = theTree[theTabId] || [];
    function traverse_and_mark(o) {
        // Mark as selected so our UI tree opens to this node
        o["select"] = false;
        o["focus"] = false;
        if (o["key"] === whichNodeKey[theTabId]) {
            o["select"] = true;
            o["focus"] = true;
        }

        var children = o["children"] || [];
        for (e in children) {
            var e = children[e];
            traverse_and_mark(e);
        }
    }
    // Mark the active tree state as selected for the UI
    for (e in tree) {
        var e = tree[e];
        traverse_and_mark(e);
    }
    return tree;
}
//
// End UI Operations
//

// Tab onCreated
// Create a new root node in our theTree
chrome.tabs.onCreated.addListener(function(tab) {
    // Check here to make sure we aren't clobbering if onTabReplaced got called first
    var id = "_" + tab.id;
    if (theTree[id] === undefined) {
        // 0 is the node level
        var key = hash(tab.url.replace(/.*?:\/\//g, "")); // replace removes protocols - prevents different hashes for similar urls like https vs http
        theTree[id] = [node(tab.title, tab.url, key)];
        theTabId = id;
        whichNodeKey[id] = id;

        l("tab added to tree at id: " + id);
    }
});

// Tab onRemoved
// Remove the node from theTree
// In the future, it'd be nice to be able to restore a tab's undo/redo state
// Unfortunately restored tabs get new tab ids.
// However, they do trigger the reload transition so something may be possible.
chrome.tabs.onRemoved.addListener(function(tab_id) {
    // TODO: Handle restoration of state
    var id = "_" + tab_id;
    delete theTree[id];
    delete whichNodeKey[id];

    l("tab deleted from tree at id: " + id);
});

// Tab onActivated
// Switch our node pointer to indicate which tree needs to be shown in the UI
chrome.tabs.onActivated.addListener(function(info) {
    var id = "_" + info.tabId;
    theTabId = id;

    l("activated: " + info.tabId);
});

// webNavigation onTabReplaced
// Used to handle the case when a user is using Chrome's advanced
// prerendering feature
chrome.webNavigation.onTabReplaced.addListener(function(details) {
    var old_id = "_" + details.replacedTabId;
    var new_id = "_" + details.tabId;

    theTree[new_id] = theTree[old_id];
    delete theTree[old_id];    

    whichNodeKey[new_id] = whichNodeKey[old_id];
    delete whichNodeKey[old_id];

    l("replaced (old, new): " + details.replacedTabId + ", " + details.tabId);
});

// tab onUpdated
// Used to update any empty tree element titles
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Only bother on complete, otherwise we don't have a page title
    if (changeInfo.status === "complete") {
        function updateTabTitle() {
            function traverse_and_update_titles(o) {
                // Update the title if we have a matching URL
                if (o["url"] === tab.url) {
                    o["title"] = tab.title;
                    o["icon"] = tab.favIconUrl;
                }

                var children = o["children"] || [];
                for (e in children) {
                    var e = children[e];
                    traverse_and_update_titles(e);
                }
            }

            var tree = theTree[theTabId] || [];
            for (e in tree) {
                var e = tree[e];
                traverse_and_update_titles(e);
            }
        }

        // Update the tab title
        updateTabTitle();
        // Try once more in 250ms to handle pages like Google Instant that update the title after load
        setTimeout(updateTabTitle, 250);
    }
});

chrome.history.onVisited.addListener(function(result) {
    function traverse_and_add_child(o, child) {
        // Mark as selected so our UI tree opens to this node
        if (o["key"] === whichNodeKey[theTabId] && o["key"] !== child["key"]) {
            // Adds a child only if this state doesn't exist in our tree already
            for (e in o["children"]) {
                var e = o["children"][e];
                if (e["key"] === child["key"]) {
                    return;
                }
            }

            // Add the child node
            if (o["children"] === undefined || o["children"] === null) {
                o["children"] = [];
            }
            o["children"].push(child);

            return;
        }

        var children = o["children"] || [];
        for (e in children) {
            var e = children[e];
            traverse_and_add_child(e, child);
        }
    }

    if (result.url !== ignoreStateChange) {
        // Unique key based on the url and parent
        var tree = theTree[theTabId] || [];

        // TODO: Add something to the hash to indicate it's position in the tree
        var newNodeKey = hash(result.url.replace(/.*?:\/\//g, "")); // replace removes protocols - prevents different hashes for similar urls like https vs http

        // Add the child node and update our selected node
        for (e in tree) {
            var e = tree[e];
            traverse_and_add_child(e, node(result.title || result.url, result.url, newNodeKey, null));
        }
        whichNodeKey[theTabId] = newNodeKey;
    }
    ignoreStateChange = "";

    l("added to history");
});
