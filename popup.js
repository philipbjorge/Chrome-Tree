// The popup is recreated on each click (Chrome behavior).

$(function(){
    // Attach the dynatree widget to an existing <div id="tree"> element
    // and pass the tree options as an argument to the dynatree() function:
    var tree = $("#tree").dynatree({
        onActivate: function(node) {
            var bg = chrome.extension.getBackgroundPage();
            bg.whichNodeKey[bg.theTabId] = node.data.key;
            chrome.tabs.update(parseInt(bg.theTabId.slice(1)), {url: node.data.url});
        },
        onPostInit: function() {
            // Show and focus selected node no matter what depth
            var bg = chrome.extension.getBackgroundPage();
            var k = bg.whichNodeKey[bg.theTabId];
            var n = this.getNodeByKey(k);
            n.activateSilently();
        },
        children: chrome.extension.getBackgroundPage().getTree(),
        clickFolderMode: 1,
        selectMode: 1,
        debugLevel: 0
    });
});
