# Fills empty (null) KB fields with general agronomy values. Never overwrites a value you already set.
import json, glob
SRC = "General agronomy practice; reviewer to verify before approval"
PROC = {
 "PROC-ORG-MATTER": dict(rate=3, unit="kg per m2", stabilization_days=7),
 "PROC-MULCH": dict(rate=5, unit="cm depth", stabilization_days=0),
 "PROC-BIOCHAR": dict(rate=0.5, unit="kg per m2", stabilization_days=7),
 "PROC-WINDBREAK": dict(rate="1 barrier row per 10 m of exposed plot width, across the prevailing wind", unit="", stabilization_days=0),
 "PROC-DRAINAGE": dict(rate="Channels about 30 cm wide and 30 cm deep, spaced 5-10 m apart, falling toward an outlet", unit="", stabilization_days=7),
 "PROC-LEACH": dict(rate=150, unit="mm of low-salt water per leaching event; repeat until crust is gone", stabilization_days=7),
 "PROC-DECOMPACT": dict(rate="Loosen to 25-30 cm depth", unit="", stabilization_days=3),
 "PROC-COVER-CROP": dict(rate=5, unit="g legume seed per m2", stabilization_days=0),
 "PROC-SHADE": dict(rate="30-50% shade cloth or mulch cover over seedlings until established", unit="", stabilization_days=0),
}
ARCH = {
 "ARC-SANDY": ("5.5-7.0", None),
 "ARC-ARID": ("7.0-8.5", dict(texture_class="Clay-loam crust to loose sand", drainage="Poor when crusted, rapid when sandy", organic_matter="Low", cec="Low to moderate")),
 "ARC-WATERLOGGED": ("5.5-6.5", dict(texture_class="Clay / silty clay", drainage="Very poor", organic_matter="Moderate, partly decomposed", cec="Moderate to high")),
 "ARC-SALINE": ("7.5-8.5", dict(texture_class="Sand / loamy sand", drainage="Rapid", organic_matter="Low", cec="Low")),
 "ARC-COMPACTED": ("5.5-7.0", dict(texture_class="Compacted loam / clay loam", drainage="Poor infiltration", organic_matter="Low", cec="Moderate")),
 "ARC-DISTURBED": ("5.5-7.0", dict(texture_class="Compacted loam / clay loam", drainage="Poor infiltration", organic_matter="Low (topsoil lost)", cec="Low to moderate")),
}
def C(dur, depth, spacing, method, fert, dis, pest, ctrl, ind, hm, ph, note=None):
    d = dict(duration_days=dur, planting=dict(depth=depth, spacing=spacing, method=method),
             care=dict(fertilizer=fert, diseases=dis, pests=pest, controls=ctrl),
             harvest=dict(indicators=ind, method=hm), phase_days=dict(zip(["P1","P2","P3","P4"], ph)))
    if note: d["duration_note"] = note
    return d
CROP = {
 "CROP-COWPEA": C([60,75],"2-4 cm","10 cm in row, 40-50 cm between rows","Direct sow into moist, prepared soil","Little nitrogen needed (fixes its own). Compost at bed prep; phosphorus if available.",
   ["Fusarium wilt","Powdery mildew","Cercospora leaf spot"],["Aphids","Pod borers (Maruca)","Thrips"],["Neem oil spray","Rotate with cereals","Intercrop with sorghum or millet","Use clean seed"],
   ["Pods dry and yellow-brown","Seeds hard and rattle in the pod"],"Hand-pick pods as they dry in several passes; sun-dry before storage",["3-7","20-25","20-30","7-10"]),
 "CROP-SORGHUM": C([90,120],"2-4 cm","15-20 cm in row, 60-75 cm between rows","Direct sow into prepared soil","Modest nitrogen and phosphorus; well-rotted compost at bed prep; light top-dress at knee-height stage.",
   ["Anthracnose","Grain mold","Rust"],["Shoot fly","Stem borer","Birds at grain stage"],["Neem-based spray","Intercrop with cowpea to disrupt stem borer","Seed treatment with Trichoderma","Reflective ribbon against birds"],
   ["Grain too hard to dent with a thumbnail","Heads turn brown","Dark layer visible at seed base"],"Cut heads, dry fully, then thresh",["5-10","30-40","30-40","10-14"]),
 "CROP-PMILLET": C([65,90],"2-3 cm","10-15 cm in row, 45-50 cm between rows","Direct sow into prepared soil","Low demand; compost at bed prep and a small nitrogen top-dress at tillering.",
   ["Downy mildew","Ergot","Rust"],["Stem borer","Shoot fly","Birds"],["Clean or resistant seed","Remove infected plants early","Neem spray"],
   ["Ear heads dry and firm","Grains hard and fully coloured"],"Cut ear heads, sun-dry, then thresh",["3-5","20-25","25-35","7-10"]),
 "CROP-AMARANTH": C([30,40],"0.5-1 cm (tiny seed; mix with sand)","10-15 cm in row, 30-45 cm between rows; thin seedlings","Broadcast or drill shallowly into fine, moist soil","Light feeder; compost at bed prep and a light nitrogen feed after the first leaf cut.",
   ["Damping-off","Leaf spot","Root rot in wet soil"],["Aphids","Leaf webbers","Caterpillars"],["Neem spray","Avoid overwatering","Thin plants for airflow"],
   ["Leafy harvest: leaves tender, 30-40 days","Grain harvest: seed heads dry and seed shakes loose, 90-110 days"],"Cut young shoots for leafy harvest; cut and dry seed heads, then thresh for grain",["3-5","15-25","40-60 (grain)","7-10"],
   "Leafy harvest 30-40 days; grain harvest 90-110 days."),
 "CROP-RICE": C([100,150],"2-3 cm; transplant 2-3 seedlings per hill","20 x 20 cm","Transplant 20-30 day seedlings into puddled soil with shallow standing water","Compost at bed prep; split nitrogen at tillering and panicle initiation.",
   ["Blast","Sheath blight","Bacterial leaf blight"],["Stem borer","Brown planthopper"],["Resistant varieties","Balanced nitrogen","Brief field drainage to disrupt pests","Neem spray"],
   ["80-85% of grains straw coloured","Grains hard"],"Drain field 7-10 days before; cut, dry, thresh",["5-10","30-40","35-45","10-15"]),
 "CROP-TARO": C([180,240],"5-10 cm","60 x 60 cm","Plant corm pieces or suckers on wet ridges","Compost-heavy; potassium-rich organic matter.",
   ["Taro leaf blight","Corm rot"],["Aphids","Armyworm"],["Remove infected leaves","Use disease-free planting material","Keep wide spacing"],
   ["Leaves yellow and die back","Corms firm"],"Dig corms carefully; cure before storage",["14-21","60-90","60-90","14-21"]),
 "CROP-BARLEY": C([90,120],"3-5 cm","Drill in rows 20 cm apart","Drill or broadcast and cover","Moderate nitrogen, split; compost at bed prep; avoid chloride-heavy fertilizers.",
   ["Powdery mildew","Net blotch","Rust"],["Aphids","Armyworm"],["Resistant varieties","Crop rotation","Neem spray"],
   ["Heads golden","Grains hard"],"Cut when dry, thresh, store below 12% moisture",["5-10","30-40","30-40","10-14"]),
 "CROP-PIGEONPEA": C([150,180],"3-5 cm","30 cm in row, 75-90 cm between rows","Direct sow into loosened soil","Little nitrogen; phosphorus helpful; compost at bed prep.",
   ["Fusarium wilt","Sterility mosaic","Phytophthora blight"],["Pod borer","Pod fly","Aphids"],["Neem spray","Intercrop with cereals","Resistant varieties","Pheromone traps"],
   ["Pods brown and dry","Seeds hard"],"Hand-pick or cut dry pods in passes; thresh",["5-10","40-60","50-70","10-15"]),
 "CROP-TOMATO": C([90,120],"0.5-1 cm in nursery; transplant at 5 cm","45 x 60 cm","Raise seedlings, then transplant","Heavy feeder: rich compost plus balanced NPK, split through the season.",
   ["Early blight","Late blight","Bacterial wilt"],["Whitefly","Fruit borer"],["Neem spray","Crop rotation","Stake and prune for airflow"],
   ["Fruit fully coloured and slightly firm"],"Hand-pick ripe fruit regularly",["5-8","25-30","30-45","7-14"]),
}
def fill(d, vals):
    for k, v in vals.items():
        cur = d.get(k)
        if cur is None or cur == "" or cur == []: d[k] = v
        elif isinstance(cur, dict) and isinstance(v, dict): fill(cur, v)
for f in glob.glob("kb/*.json") + ["knowledge_base.json"]:
    d = json.load(open(f))
    for p in d.get("procedures", []):
        if p["id"] in PROC and p.get("rate") is None:
            p.update(PROC[p["id"]]); p.pop("rate_note", None)
    for c in d.get("readiness_criteria", []):
        if c["id"] == "RC-STAB" and c.get("window_days") is None: c["window_days"] = 3; c["if_failed"] = "Wait for the stabilization window to pass, then repeat."
    for a in d.get("archetypes", []):
        if a["id"] in ARCH:
            ph, est = ARCH[a["id"]]; a.setdefault("typical_estimates", {})
            if est: fill(a["typical_estimates"], est)
            if a["typical_estimates"].get("ph_range") is None: a["typical_estimates"]["ph_range"] = ph
    for c in d.get("crops", []):
        if c["id"] in CROP:
            if c.get("duration_days") is None: c["duration_days"] = CROP[c["id"]]["duration_days"]
            fill(c, {k: v for k, v in CROP[c["id"]].items() if k != "duration_days"})
            c.get("planting", {}).pop("note", None)
    json.dump(d, open(f, "w"), indent=1)
print("filled")
