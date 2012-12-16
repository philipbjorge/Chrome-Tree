// The popup is recreated on each click (Chrome behavior).

$(function(){
    // Attach the dynatree widget to an existing <div id="tree"> element
    // and pass the tree options as an argument to the dynatree() function:
    var tree = $("#tree").dynatree({
        onActivate: function(node) {
            var bg = chrome.extension.getBackgroundPage();
            // Update theTree's current path and ignore this state change
            bg.theTree.goTo(node.data.fullpath, node.data.url);
            chrome.tabs.update(parseInt(bg.theTree.tab.slice(1)), {url: node.data.url});
        },
        onPostInit: function() {
            // Show and focus selected node no matter what depth
            var bg = chrome.extension.getBackgroundPage();
            var n = this.getNodeByKey(bg.theTree.getActiveKey());
            n.activateSilently();
        },
        children: chrome.extension.getBackgroundPage().theTree.renderMe(),
        clickFolderMode: 1,
        selectMode: 1,
        debugLevel: 0
    });
});
