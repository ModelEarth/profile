// Fixed 12 master categories used for controlled product navigation.
// Folder names from GitHub are matched using deterministic substring checks.
// YAML contents DO NOT influence grouping.

const MAIN_CATEGORY_MAP = {
    "Concrete": [
        "concrete",
        "ready-mix",
        "readymix",
        "precast",
        "block",
        "blocks",
        "cement",
        "masonry"
    ],

    "Steel": [
        "steel",
        "rebar",
        "sheet",
        "coil",
        "rolled",
        "metal"
    ],

    "Aluminium": [
        "aluminium",
        "aluminum",
        "extruded_aluminum",
        "extrusion"
    ],

    "Wood": [
        "wood",
        "timber",
        "lumber",
        "plywood",
        "engineered_wood"
    ],

    "Glass": [
        "glass",
        "glazing"
    ],

    "Insulation": [
        "insulation",
        "acoustic",
        "acoustical",
        "acoustical_ceilings",
        "ceiling",
        "fiberglass",
        "mineral_wool",
        "foam",
        "sound",
        "thermal"
    ],

    "Roofing": [
        "roof",
        "roofing",
        "shingle",
        "membrane",
        "tpo",
        "epdm"
    ],

    "Flooring": [
        "floor",
        "flooring",
        "tile",
        "tiles",
        "carpet",
        "vinyl",
        "hardwood"
    ],

    "Plastics": [
        "plastic",
        "poly",
        "pvc",
        "polyethylene",
        "polypropylene",
        "polymer"
    ],

    "Paints": [
        "paint",
        "painted",
        "coating",
        "finish"
    ],

    "Composites": [
        "composite",
        "frp",
        "fiber_reinforced",
        "laminate"
    ],

    // For anything unmatched
    "Misc": []
};

// Determine the master category for a given GitHub folder.
// Returns null if unmatched (label.js should send unmatched to "Misc").
function categoryForFolder(folderName) {
    const f = folderName.toLowerCase();

    for (const main of Object.keys(MAIN_CATEGORY_MAP)) {
        const keys = MAIN_CATEGORY_MAP[main];
        for (const key of keys) {
            if (f.includes(key)) return main;
        }
    }

    return null;
}

export { MAIN_CATEGORY_MAP, categoryForFolder };
