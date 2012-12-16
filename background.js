function l(s) {
    console.log(s);
}

// The Hash function - taken from
// http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
this.hash = function(s) {
    var hash = 0;
    if (s.length == 0) return hash;
    for (i = 0; i < s.length; i++) {
        char = s.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

function TheTree() {
    // tabs stores each tree and it's status
    // tabsActive stores the currently active path for each tab in tabs, keyed with the same value (_tabid)
    // tab stores which tab in tabs
    // urlInfo stores URL information in a centralized location to speed up async url updates
    // ignoreUrlOnce stores an ignore URL for each tab - used when traversing up a tree to prevent graphs/duplicate trees
    this.tabs = {};
    this.tabsActive = {};
    this.tab = "";
    this.urlInfo = {};
    this.ignoreUrlOnce = {};

    this.hashUrl = function(u) {
        return hash(u.replace(/.*?:\/\//g, ""));
    };

    // Adds a tab entry to this.tabs if one doesn't exist for this tab id
    this.addTab = function(id, title, url) {
        var tid = "_" + id;
        if (this.tabs[tid] === undefined) {
            var h = this.hashUrl(url);
            this.tabs[tid] = {key: h, children: []};
            this.urlInfo[h] = {title: title, url: url, icon: null};
            this.tabsActive[tid] = "";
            this.setTab(id);
            l("tab added to tree at id: " + id);
        } else { l("tab not added to tree at id: " + id); }
    };

    this.goTo = function(new_path, url) {
        this.tabsActive[this.tab] = new_path;
        this.ignoreUrlOnce[this.tab] = url;
    };

    // Replaces the tree's old id with a new id
    this.setTabId = function(o, n) {
        var old_id = "_" + o;
        var new_id = "_" + n;

        this.tabs[new_id] = this.tabs[old_id];
        this.tabsActive[new_id] = this.tabsActive[old_id];

        delete this.tabs[old_id];
        delete this.tabsActive[old_id];

        l("setTabId (old, new): " + old_id + ", " + new_id);
    };

    this.markDelete = function(id) {
        // Mark these tabs for deletion and then do periodic sweeps for removal
        // This will allow restoration on tab close.
        // However, they do trigger the reload transition so something may be possible.
        var id = "_" + id;
        delete this.tabs[id];
        delete this.tabsActive[id];
        l("tab deleted from tree at id: " + id);
    };

    // Set the current tab's history to show in the UI
    this.setTab = function(id) {
        this.tab = "_" + id;
        l("setTab: " + this.tab);
    };


    // Updates a url with it's title and icon
    this.updateNode = function(url, title, icon) {
        var h = this.hashUrl(url);
        var n = this.urlInfo[h] || {};
        n["url"] = url;
        n["title"] = title;
        n["icon"] = icon;
        this.urlInfo[h] = n;
        l("updateNode with url: " + url);
    };

    this.addNode = function(id, url, title) {
        var tab_id = "_" + id;
        if (url !== this.ignoreUrlOnce[tab_id]) {
            // Add the node
            // By traversing the path until we get to the parent
            var path = this.tabsActive[tab_id] || "";
            var node = this.tabs[tab_id];
            for (var i = 0; i < path.length; i++) {
                node = node.children[parseInt(path[i])];
            }

            // Update tabsActive, tabs, and urlInfo
            var h = this.hashUrl(url);

            // Don't add if we already have the url in this set of children
            var alreadyInChildren = false;
            for (var i = 0; i < node.children.length; i++) {
                if (node.children[i].key === h)
                    alreadyInChildren = true;
            }
            if (!alreadyInChildren)
                this.tabsActive[tab_id] += node.children.push({key: h, children: []}) - 1;

            this.urlInfo[h] = this.urlInfo[h] || {url: url, title: title || url, icon: ""};
        }
        this.ignoreUrlOnce[tab_id] = "";
        l("added " + url + " to history for tab id: " + tab_id);
    };

    // Return the active node's key for the current tab
    // path + url
    this.getActiveKey = function() {
        var path = this.tabsActive[this.tab] || "";
        var node = this.tabs[this.tab];
        for (var i = 0; i < path.length; i++) {
            node = node.children[parseInt(path[i])];
        }
        return path + node.key;
    };

    this.renderMe = function() {
        // Deep copy of the tree
        var tree = JSON.parse(JSON.stringify(this.tabs[this.tab])) || [];

        function populate(t, o, fp) {
            var d = t.urlInfo[o.key];
            // ukey for the url key, key for the unique path + url key
            o.ukey = o.key;
            o.key = fp + o.key;
            o.url = d.url;
            o.title = d.title;
            o.icon = d.icon;
            o.fullpath = fp;
            for (var i = 0; i < o.children.length; i++) {
                populate(t, o.children[i], fp + i);
            }
        };

        populate(this, tree, "");

        return tree;
    };
}

var theTree = new TheTree();

// ///////////////////////////////////////////////////////////////////
//
// Chrome Event Handlers
//
// ///////////////////////////////////////////////////////////////////

// Tab onCreated
// Create a new root node in our theTree
chrome.tabs.onCreated.addListener(function(tab) {
    theTree.addTab(tab.id, tab.title, tab.url);
});

// Tab onRemoved
// Remove the node from theTree
chrome.tabs.onRemoved.addListener(function(tab_id) {
    theTree.markDelete(tab_id);
});

// Tab onActivated
// Switch our node pointer to indicate which tree needs to be shown in the UI
chrome.tabs.onActivated.addListener(function(info) {
    theTree.setTab(info.tabId);
});

// webNavigation onTabReplaced
// Used to handle the case when a user is using Chrome's advanced
// prerendering feature
chrome.webNavigation.onTabReplaced.addListener(function(details) {
    theTree.setTabId(details.replacedTabId, details.tabId);
});

// tab onUpdated
// Used to update any empty tree element titles
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Only bother on complete, otherwise we don't have a page title
    if (changeInfo.status === "complete") {
        // Update the tab title
        // Try once more in 250ms to handle pages like Google Instant that update the title after load
        theTree.updateNode(tab.url, tab.title, tab.favIconUrl);
        setTimeout(function(){ theTree.updateNode(tab.url, tab.title, tab.favIconUrl); }, 250);
    }
});

chrome.history.onVisited.addListener(function(result) {
    // Find out which tab(s) have this result as their current page
    // Then add to their parent
    chrome.tabs.query({url: result.url}, function(tabs) {
        for (var i = 0; i < tabs.length; i++) {
            theTree.addNode(tabs[i].id, result.url, result.title);
        }
    });
});
