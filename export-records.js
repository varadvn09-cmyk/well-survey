// export-records.js
// Adds exportToExcel() that exports local records in the exact column order requested by the user.
// This file assumes the page already includes SheetJS (XLSX) and that records are stored in
// localStorage key 'HYDROGEO_SURVEY_RECORDS_V22' as an array of objects.

(function(){
  const STORAGE_KEY = 'HYDROGEO_SURVEY_RECORDS_V22';

  // Exact header columns (as requested by the user)
  const HEADER = [
    "Sr.No.","Date","Time","Geologist Name","Mapsheetno","well no","Type of well","Well Owner","District Name","Taluka Name","Gp Name","Village Name","Cencess no","Toposheet no","mini watershed","Population","LatLong","Altitude","Gat no","Qurdant","Measuring Point","Parapet (m)","Diameter (m)","effec. Dia","Depth","Curbing (m)","Type of curbing","Year of Construction","DwL","Winter (SWL)","Summer (SWL)","Type of Pump","Mode of Power","HP","Winter pumping hrs","Summer pumping hrs","winter T req recuperation","Summer T req recuperation","Project Irri(PT/MInor)","Distance","Canal","Distance c","Cultivable land (Ha)","Kharif Crop1","Kharif Crop2","Kharif Crop3","Kharif Crop land Flood (Ha)1","Kharif Crop land Flood (Ha)2","Kharif Crop land Flood (Ha)3","Kharif Crop land Sprinkler (Ha)1","Kharif Crop land Sprinkler (Ha)2","Kharif Crop land Sprinkler (Ha)3","Kharif Crop land Drip (Ha)1","Kharif Crop land Drip (Ha)2","Kharif Crop land Drip (Ha)3","Rabbi Crop1","RabbiCrop2","Rabbi Crop3","Rabbi Crop land Flood (Ha)1","Rabbi Crop land Flood (Ha)2","Rabbi Crop land Flood (Ha)3","Rabbi Crop land Sprinkler (Ha)1","Rabbi Crop land Sprinkler (Ha)2","Rabbi Crop land Sprinkler (Ha)3","Rabbi Crop landDrip (Ha)1","Rabbi Crop landDrip (Ha)2","Rabbi Crop land Drip (Ha)3","Perennial Crop 1","Perennial Crop 2","Perennial Crop 1 Flood land (Ha)","Perennial Crop 2 Flood land (Ha)","Perennial Crop1 Drip land (Ha)","Perennial Crop2 Drip land (Ha)","Summer Crops 1","Summer Crops 2","Summer Crops Flood 1 land (Ha)","Summer Crops Flood 2 land (Ha)","Summer Crops Sprinkler 1 land (Ha)","Summer Crops Sprinkler 2 land (Ha)","SummerCrop Drip 1 land (Ha)","SummerCrop Drip 2 land (Ha)","Photo","Litho 1","Depth Litho 1","Litho 2","Depth Litho 2","Litho 3","Depth Litho 3","Litho4","Depth Litho4","nearest well","Remarks"
  ];

  // Mapping from header column to record key (input IDs used in index.html)
  const MAP = {
    "Sr.No.": 'srNo',
    "Date": 'surveyDate',
    "Time": 'surveyTime',
    "Geologist Name": 'geologistName',
    "Mapsheetno": 'mapSheetNo',
    "well no": 'wellSeqNo',
    "Type of well": 'wellType',
    "Well Owner": 'ownerName',
    "District Name": 'district',
    "Taluka Name": 'taluka',
    "Gp Name": 'gpName',
    "Village Name": 'village',
    "Cencess no": 'censusNo',
    "Toposheet no": 'sheet10k',
    "mini watershed": 'watershedNo',
    "Population": 'population',
    "LatLong": 'gpsCoords',
    "Altitude": 'altitudeGL',
    "Gat no": 'gatNo',
    "Qurdant": 'quadrantNo',
    "Measuring Point": 'mpLocation',
    "Parapet (m)": 'parapetHeight',
    "Diameter (m)": 'diaTop',
    "effec. Dia": 'diaEffective',
    "Depth": 'depthWell',
    "Curbing (m)": 'depthLining',
    "Type of curbing": 'liningMaterial',
    "Year of Construction": 'yearConstruction',
    "DwL": 'dwl',
    "Winter (SWL)": 'swlWinter',
    "Summer (SWL)": 'swlSummer',
    "Type of Pump": 'pumpType',
    "Mode of Power": 'powerMode',
    "HP": 'pumpHP',
    "Winter pumping hrs": 'pumpDurationWinter',
    "Summer pumping hrs": 'pumpDurationSummer',
    "winter T req recuperation": 'recupWinter',
    "Summer T req recuperation": 'recupSummer',
    "Project Irri(PT/MInor)": 'reservoirType',
    "Distance": 'reservoirDistDir',
    "Canal": 'canalName',
    "Distance c": 'canalDistDir',
    "Cultivable land (Ha)": 'cultivableLand',

    // Kharif
    "Kharif Crop1": 'kharifCrop1',
    "Kharif Crop2": 'kharifCrop2',
    "Kharif Crop3": 'kharifCrop3',
    "Kharif Crop land Flood (Ha)1": 'kharifFloodHa1',
    "Kharif Crop land Flood (Ha)2": 'kharifFloodHa2',
    "Kharif Crop land Flood (Ha)3": 'kharifFloodHa3',
    "Kharif Crop land Sprinkler (Ha)1": 'kharifSprinklerHa1',
    "Kharif Crop land Sprinkler (Ha)2": 'kharifSprinklerHa2',
    "Kharif Crop land Sprinkler (Ha)3": 'kharifSprinklerHa3',
    "Kharif Crop land Drip (Ha)1": 'kharifDripHa1',
    "Kharif Crop land Drip (Ha)2": 'kharifDripHa2',
    "Kharif Crop land Drip (Ha)3": 'kharifDripHa3',

    // Rabi (note user wrote Rabbi)
    "Rabbi Crop1": 'rabiCrop1',
    "RabbiCrop2": 'rabiCrop2',
    "Rabbi Crop3": 'rabiCrop3',
    "Rabbi Crop land Flood (Ha)1": 'rabiFloodHa1',
    "Rabbi Crop land Flood (Ha)2": 'rabiFloodHa2',
    "Rabbi Crop land Flood (Ha)3": 'rabiFloodHa3',
    "Rabbi Crop land Sprinkler (Ha)1": 'rabiSprinklerHa1',
    "Rabbi Crop land Sprinkler (Ha)2": 'rabiSprinklerHa2',
    "Rabbi Crop land Sprinkler (Ha)3": 'rabiSprinklerHa3',
    "Rabbi Crop landDrip (Ha)1": 'rabiDripHa1',
    "Rabbi Crop landDrip (Ha)2": 'rabiDripHa2',
    "Rabbi Crop land Drip (Ha)3": 'rabiDripHa3',

    // Perennial
    "Perennial Crop 1": 'perennialCrop1',
    "Perennial Crop 2": 'perennialCrop2',
    "Perennial Crop 1 Flood land (Ha)": 'perennialFloodHa1',
    "Perennial Crop 2 Flood land (Ha)": 'perennialFloodHa2',
    "Perennial Crop1 Drip land (Ha)": 'perennialDripHa1',
    "Perennial Crop2 Drip land (Ha)": 'perennialDripHa2',

    // Summer
    "Summer Crops 1": 'summerCrop1',
    "Summer Crops 2": 'summerCrop2',
    "Summer Crops Flood 1 land (Ha)": 'summerFloodHa1',
    "Summer Crops Flood 2 land (Ha)": 'summerFloodHa2',
    "Summer Crops Sprinkler 1 land (Ha)": 'summerSprinklerHa1',
    "Summer Crops Sprinkler 2 land (Ha)": 'summerSprinklerHa2',
    "SummerCrop Drip 1 land (Ha)": 'summerDripHa1',
    "SummerCrop Drip 2 land (Ha)": 'summerDripHa2',

    "Photo": 'photo',
    "Litho 1": 'lithoType1',
    "Depth Litho 1": 'lithoDepth1',
    "Litho 2": 'lithoType2',
    "Depth Litho 2": 'lithoDepth2',
    "Litho 3": 'lithoType3',
    "Depth Litho 3": 'lithoDepth3',
    "Litho4": 'lithoType4',
    "Depth Litho4": 'lithoDepth4',
    "nearest well": 'nearestWell',
    "Remarks": 'remarks'
  };

  function safeGet(rec, key) {
    if (!rec) return '';
    const v = rec[key];
    if (v === undefined || v === null) return '';
    return v;
  }

  function exportToCustomFormat() {
    const raw = localStorage.getItem(STORAGE_KEY);
    let records = [];
    try { records = raw ? JSON.parse(raw) : []; } catch(e) { records = []; }

    // Build worksheet rows: header then rows
    const rows = [HEADER.slice()];

    records.forEach(rec => {
      const row = HEADER.map(col => {
        const key = MAP[col];
        // Some stored records may keep numbers as strings — keep as-is
        const val = key ? safeGet(rec, key) : '';
        // If this is photo field and value is a base64 data url, keep it as-is
        return val;
      });
      rows.push(row);
    });

    // Create sheet and workbook using SheetJS
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WellRecords');

    const filename = 'well-records-export.xlsx';
    XLSX.writeFile(wb, filename);
  }

  // Expose function so existing button onclick (exportToExcel) will work
  window.exportToExcel = exportToCustomFormat;
  // Also expose a named function
  window.exportRecordsInCustomFormat = exportToCustomFormat;

  console.log('[export-records.js] exportToExcel() installed — click Export Excel button to download records in the requested column order.');

})();
