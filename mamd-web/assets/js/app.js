'use strict';
const MIN_SELECTIONS = 3;
const MIN_GROUPS = 2;	// nnet requires 2, but with 2 additional coding for ctab$byClass is required in R.

const API_URL = 'https://mamd-api.ikp55qn3sn7ek.us-east-2.cs.amazonlightsail.com/mamd?';
// const API_URL = 'http://localhost:8000/mamd?';

var probs_chart = null;

function show_app() {
	$("#section-main").show();
	trackScreenView("analysis");
}

$(document).ready(function() {
	app_preload();
});

function wire_events() {
	$('[data-toggle="tooltip"]').tooltip({
		trigger: 'focus'
	});

	$("#new-button").on('click', function(e) {
		e.preventDefault();
		trackEvent("Application", "New File");
		new_case();
	});

	// $("#open-button").on('click', function(e) {
	// 	e.preventDefault();
	// 	trackEvent("Application", "Open File");
	// 	open_case();
	// });

	// $("#save-button").on('click', function(e) {
	// 	e.preventDefault();
	// 	trackEvent("Application", "Save File");
	// 	save_case();
	// });

	$("#analysis-button").on('click', function(e) {
		e.preventDefault();
		trackEvent("Application", "Run Analysis");
		$("html, body").animate({ scrollTop: 0 }, "fast");
		$('#tabs a[href="#results"]').tab('show');
		run_analysis();
	});

	$("#export-results-pdf").on('click', function(e) {
		e.preventDefault();
		trackEvent("Application", "Export PDF");
		export_to_pdf();
	});

	$(document).on('click', "input.group-checkbox", function(e) {
		var group = $(this).val();
		toggleGroupSelection(group, $(this).is(':checked'));
	});

	$(document).on('click', ".trait-image-button", function(e) {
		e.preventDefault();

		var code = $(this).parent().attr("data-trait");
		var value = $(this).parent().attr("data-value");
		toggleTraitUISelection($(this), code, value);
	});

	$('a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
		trackScreenView($(e.target).attr("id").replace("-tab", ""));
	});
}

function app_preload() {
	$.get("assets/db/db.min.json").then((data) => { 
		localStorage.setItem("db", JSON.stringify(data));
		
		window.is_dirty = false;
		window.current_file = "";
		window.current_results = "";

		localStorage.setItem("version", "1.1.0");
		localStorage.setItem("uuid", "");
		localStorage.setItem("settings.analytics", true);
		localStorage.setItem("settings.dev_mode", true);

		$("#app-version").text(localStorage.getItem("version"));

		app_init();
	});
}

function app_setupgroups() {
	var output = [];

	var groups = JSON.parse(localStorage.getItem("db")).groups;
	for (var i = 0; i < groups.length; i++) {
		output.push(groups[i].code);
	}

	return output;
}

function app_setupselections() {
	var output = {};

	var traits = JSON.parse(localStorage.getItem("db")).traits;
	for (var i = 0; i < traits.length; i++) {
		// output[traits[i].abbreviation] = "NA";
		output[traits[i].abbreviation] = -1;
	}

	// var groups = window.appdb["groups"];
	// for (var i = 0; i < groups.length; i++) {
	// 	output[groups[i].code] = 0;
	// }

	return output;
}

function app_init() {
	wire_events();
	show_groups();
	show_traits();
	//check_offline_status();

	enable_button("new-button");

	probs_chart = new Chart(document.getElementById("results-probabilities"), {
		type: 'bar',
		options: {
			responsive: true,
			legend: {
				display: false
			}
		},
		data: {
			labels: [],
			datasets: [{
				labels: 'Accuracy',
				data: []
			}]
		}
	});

	new_case();
	show_app();
}

function new_case() {
	window.groups = app_setupgroups();
	window.selections = app_setupselections();
	window.is_dirty = false;
	window.current_file = "";
	window.current_results = "";
	disable_button("save-button");

	init_case_info();
	init_results();
	show_groups();
	show_traits();
	$('#tabs a[href="#analysis"]').tab('show');

	validate_selections();
}

function open_case() {
	return;

	// dialog.showOpenDialog({
	// 	properties: ['openFile'],
	// 	title: "Open MaMD Analytical File",
	// 	buttonLabel : "Open MaMD File",
	// 	filters :[
	// 		{name: 'MaMD Analytical', extensions: ['mamd']}
	// 	]
	// }, function(files) {
	// 	if (files != undefined) {
	// 		if (files.length == 1) {
	// 			new_case();
	// 			var filePath = files[0];

	// 			fs.readFile(filePath, 'utf8', (err, data) => {
	// 				if (err) {
	// 					console.error(err);
	// 					trackException(err, false);
	// 				}

	// 				var json = JSON.parse(data);

	// 				// TODO: populate case info
	// 				$("#case_number_input").val(json['properties']['case_number']);
	// 				$("#observation_date_input").val(json['properties']['observation_date']);
	// 				$("#analyst_input").val(json['properties']['analyst']);

	// 				$.each(json['traits'], function(key, data) {
	// 					if (data != "NA") {
	// 						var row = $("#trait-" + key);
	// 						//console.log("searching in " + key);
	// 						$.each(row.find(".trait-image-button"), function (i, v) {
	// 							if ($(this).attr("data-trait") === key &&
	// 								$(this).attr("data-value") === data) {
	// 									toggleTraitUISelection($(this), key, data);
	// 								}
	// 						});
	// 					}
	// 				});

	// 				// TODO: populate results if applicable
	// 				if (json["results"] != undefined) {
	// 					show_results(json, json["results"]);
	// 					// $("#analysis-results-1").html(json["results"]["ancestry"]);
	// 					// $("#analysis-results-2").html(json["results"]["probabilities"]);
	// 					// $("#analysis-results-3").html(json["results"]["matrix"]);

	// 					// $("#analysis-pending").hide();
	// 					// $("#analysis-loading").hide();
	// 					// $("#analysis-error").hide();
	// 					// $("#analysis-results").show();
	// 				}

	// 				// set properties for file checking
	// 				window.current_file = filePath;

	// 				validate_selections();
	// 			});
	// 		}
	// 	}
	// })
}

function save_case() {
	return; 

	// // TODO: encode results strings to form valid JSON
	// var output = '{"traits":' + JSON.stringify(window.selections) + ',';
	// output += '"properties":{"case_number":"' + $("#case_number_input").val() + '",';
	// output += '"analyst":"' + $("#analyst_input").val() + '",';
	// output += '"observation_date":"' + $("#observation_date_input").val() + '"}';

	// if (JSON.stringify(window.current_results).length > 0) {
	// 	output += ', "results": ' + JSON.stringify(window.current_results);
	// }

	// // output += '"results":{"ancenstry":"' + JSON.stringify($("#analysis-results-1").html()) + '",';
	// // output += '"probabilities":"' + JSON.stringify($("#analysis-results-2").html()) + '",';
	// // output += '"matrix":"' + JSON.stringify($("#analysis-results-3").html()) + '"}';
	// output += '}';

	// console.log(output);

	// if (window.current_file == "") {
	// 	var options = {
	// 		title: "Save MaMD Analytical File",
	// 		buttonLabel : "Save MaMD File",
	// 		filters :[
	// 			{name: 'MaMD Analytical', extensions: ['mamd']}
	// 		]
	// 	};
	// 	window.current_file = dialog.showSaveDialog(null, options);
	// }

	// fs.writeFile(window.current_file, output, function(err) {
	// 	if (err) {
	// 		trackException(err, false);
	// 		console.error(err);
	// 	}
	// 	console.log("File saved");
	// });

	// window.is_dirty = false;
	// disable_button("save-button");
}

function init_results() {
	$("#analysis-pending").show();
	$("#analysis-loading").hide();
	$("#analysis-error").hide();
	$("#analysis-results").hide();
}

function init_case_info() {
	$("#case_number_input").val("");
	$("#observation_date_input").val("");
	$("#analyst_input").val("");
}

function check_offline_status() {
	// TODO: if offline, show warning message (no impact)
	window.is_offline = false;

	if (window.is_offline)
		$("#offline-alert").show();
	else
		$("#offline-alert").hide();
}

function show_groups() {
	var div = $("#group-list");
	div.empty();

	var groups = JSON.parse(localStorage.getItem("db")).groups;

	for (var i = 0; i < groups.length; i++) {
		var wrapper = $("<div></div>");
		wrapper.addClass("form-check").addClass("form-check-inline");

		var input = $("<input></input>");
		input
			.addClass("form-check-input")
			.addClass("group-checkbox")
			.attr("type", "checkbox")
			.attr("id", "chk" + groups[i].code)
			.attr("value", groups[i].code)
			.attr("checked", "yes");

		var label = $("<label></label>");
		label
			.addClass("form-check-label")
			.attr("for", "chk" + groups[i].code)
			.text(groups[i].display);

		wrapper.append(input).append(label);
		div.append(wrapper);
	}
}

function show_traits() {
	var div = $("#trait-list");
	div.empty();

	var traits = JSON.parse(localStorage.getItem("db")).traits;

	for (var i = 0; i < traits.length; i++) {
		var ttemplate = $("#trait-template").clone();
		ttemplate.removeClass("template")
			.attr("id", "trait-" + traits[i].abbreviation);
		ttemplate.find(".trait-name").text(traits[i].name);
		ttemplate.find(".trait-abbreviation").text(traits[i].abbreviation);
		// ttemplate.find(".trait-title").attr("title", traits[i].name + " (" + traits[i].abbreviation + ")");
		// ttemplate.find(".trait-title").attr("data-content", traits[i].description);

		for (var j = 0; j < traits[i].images.length; j++) {
			var itemplate = $("#trait-image-template").clone();
			itemplate.removeClass("template")
				.attr("id", traits[i].abbreviation + "-trait-image-" + j)
				.attr("data-trait", traits[i].abbreviation)
				.attr("data-value", traits[i].images[j].value);
			itemplate.find(".trait-image-button")
				.attr("data-trait", traits[i].abbreviation)
				.attr("data-value", traits[i].images[j].value);
			itemplate.find(".trait-image")
				.attr("src", "./assets/img/" + traits[i].images[j].filename)
				.attr("alt", traits[i].images[j].text + " " + j);
			itemplate.find(".trait-image-score")
				.html(`Value: ${traits[i].images[j].value}`);

			var col = ttemplate.find(".trait-col" + (j+1).toString());
			col.append(itemplate);
		}
		div.append(ttemplate);
	}
}

function toggleTraitUISelection(obj, code, value) {
	var parent = $("#trait-" + code);

	if (obj.hasClass("btn-primary")) {
		obj.removeClass("btn-primary");
		toggleTraitSelection(code, "NA", false);
	} else {
		$.each(parent.find(".trait-image-button"), function(i,v) {
			$(v).removeClass("btn-primary").addClass("btn-default");
		});
		obj.addClass("btn-primary");
		toggleTraitSelection(code, value, false);
	}

	validate_selections();
}

function toggleGroupSelection(group, include) {
	window.is_dirty = true;
	enable_button("save-button");

	let idx = window.groups.indexOf(group);
	if (include && idx <= -1) window.groups.push(group);
	if (!include && idx > -1) window.groups.splice(idx, 1);

	validate_selections();

	//console.log(window.groups);
}

function toggleTraitSelection(code, value, isExplicit) {
	window.is_dirty = true;
	enable_button("save-button");

	if (isExplicit) {
		window.selections[code] = value;
	} else {
		if (window.selections[code] === value)
			window.selections[code] = "NA";
		else
			window.selections[code] = value;
	}

	//console.log(window.selections);
}

function generate_inputfile() {
	var groups = window.groups.join();
	let qs = `group_list=${groups}`;
	
	for (var key in window.selections) {
		qs += `&${key}=${window.selections[key]}`;
	}

	return qs;
}

function validate_selections() {
	let isSelectionsValid = valid_selections() >= MIN_SELECTIONS;
	let isGroupsValid = valid_groups() >= MIN_GROUPS;

	$("#min-selection-warning").hide();
	$("#min-group-warning").hide();
	disable_button("analysis-button");

	if (!isSelectionsValid)
		$("#min-selection-warning").empty().html(`Please score ${MIN_SELECTIONS} or more traits before running the analysis.`).show();

	if (!isGroupsValid)
		$("#min-group-warning").empty().html(`Please select ${MIN_GROUPS} or more groups before running the analysis.`).show();

	if (isSelectionsValid && isGroupsValid) enable_button("analysis-button");
}

function valid_groups() {
	return window.groups.length;
}

function valid_selections() {
	let selection_count = 0;
	for (var key in window.selections) {
		if (window.selections[key] != "NA")
			selection_count++;
	}
	return selection_count;
}

function run_analysis() {
	trackEvent("Analysis", "Start");

	$("#analysis-pending").hide();
	$("#analysis-results").hide();
	$("#analysis-error").hide();
	$("#analysis-loading").show();

	if (valid_selections() >= MIN_SELECTIONS) {
		var querystring = generate_inputfile();
		// console.log(querystring);
		
		if (querystring.length > 0) {
			fetch_api_results(querystring);
		}
		//var timeout = setTimeout(show_results, 5000);
	} else {
		trackEvent("Analysis", "Validation", "Too Few Selections");
		$("#analysis-error-message").empty().text(`Please score ${MIN_SELECTIONS} or more traits before running the analysis.`);
		$("#analysis-error").show();
	}
}

function fetch_api_results(querystring) {
	let url = `${API_URL}${querystring}`;
	console.log(url);

	$.get(url).then((data) => { 
		trackEvent("Analysis", "Complete");
		show_results(null, data);
	}).fail((json) => {
		let err = JSON.parse(JSON.stringify(json));
		console.error(err);

		let msg = err.readyState == 4 ? err.responseJSON.error : "Unknown";
		trackEvent("Analysis", "Validation", "Input File");
		$("#analysis-error-message").empty().text(msg);
		$("#analysis-error").show();
	});
}

function sort_probabilities(probs) {
	let sortable = [];
	for (var key in probs) {
		sortable.push([key, probs[key]]);
	}
	sortable.sort(function(a, b) {
		return parseFloat(b[1]) - parseFloat(a[1]);
	});
	return sortable;
}

function show_results(fullJson, data) {
	var json = data;
	try {
		json = JSON.parse(data);
	} catch { }
	window.current_results = json;

	console.log(json);

	var pred = json['prediction'];
	var sens = json['sensitivity'];
	var spec = json['specificity'];
	var probs = json['probabilities'][0];
	var prob = 0;
	var accuracy = json['accuracy'];
	var accuracyLower = json['accuracyLower'];
	var accuracyUpper = json['accuracyUpper'];
	var matrix = json['matrix'];
	var matrixPercentages = json['matrixPercentages'];
	var groups = window.groups;
	
	var db = JSON.parse(localStorage.getItem("db"));
	var traits = db.traits;

	var acc = (parseFloat(accuracy) * 100).toFixed(2) + "%";
	var ci = "(" + parseFloat(accuracyLower).toFixed(4) + ", " + parseFloat(accuracyUpper).toFixed(4) + ")";
	var sensitivity = parseFloat(sens).toFixed(4);
	var specificity = parseFloat(spec).toFixed(4);

	$("#results-ancestry").text(get_group_name(pred));
	$("#results-accuracy").text(acc);
	$("#results-ci").text(ci);
	$("#results-sensitivity").text(sensitivity);
	$("#results-specificity").text(specificity);

	// probs.sort(function(a, b) {
	// 	return parseFloat(b.probability) - parseFloat(a.probability);
	// });

	let sorted_probs = sort_probabilities(probs);
	console.log(probs);
	console.log(sorted_probs);
	
	var probs_labels = [];
	var probs_data = [];

	for (var i = 0; i < sorted_probs.length; i++) {
		probs_labels.push(get_group_name(sorted_probs[i][0]));
		probs_data.push(Number(sorted_probs[i][1]));
		if (Number(sorted_probs[i][1]) > prob) {
			prob = Number(sorted_probs[i][1]);
		}
	}

	$("#results-probability").text(parseFloat(prob).toFixed(4));

	probs_chart.clear();
	//console.log(probs_chart.data.datasets.length);

	probs_chart.data.labels = probs_labels;
	probs_chart.data.datasets[0].data = probs_data;
	probs_chart.update();


	var trait_table = $("#results-traits").find("tbody");
	trait_table.empty();
	for (var i = 0; i < traits.length; i++) {
		var trait = get_trait_name(traits[i].abbreviation);
		var score = window.selections[traits[i].abbreviation];
		if (score === -1)
			score = "NA";
		var row = $("<tr></tr>");
		var col1 = $("<td></td>");
		var col2 = $("<td></td>");
		col1.text(trait + " (" + traits[i].abbreviation + ")");
		col2.addClass("text-center").text(score);
		row.append(col1).append(col2);
		trait_table.append(row);
	}

	var matrix_head = $("#results-matrix").find("thead");
	matrix_head.empty();
	var matrix_body = $("#results-matrix").find("tbody");

	var matrix_head_row = $("<tr></tr>");
	matrix_head_row.append($("<th></th>"));	// reference group
	matrix_head_row.append($("<th>Groups</th>"));	// group count

	for (var i = 0; i < groups.length; i++) {
		//let grp = window.appdb['groups'].find(x => { return x.code == groups[i]; });
		let grp = db.groups.find(x => { return x.code == groups[i]});
		matrix_head_row.append($("<th></th>").addClass("text-center").text(grp.display));
	}
	matrix_head.addClass("thead-dark").append(matrix_head_row);

	matrix_body.empty();
	for (var i = 0; i < groups.length; i++) {
		let grp = db.groups.find(x => { return x.code == groups[i]; });
		let grp_ref = matrix.filter(x => x.Reference === grp.code);
		let grp_prob = probs[grp.code];
		// let grp_ref_perc = matrixPercentages.filter(x => x.Reference === grp.code);

		let grp_count = 0;
		if (grp_ref.length > 0) {
			grp_count = grp_ref.reduce( function(a, b){
				return a + b.Freq;
			  }, 0);
		}
		
		var row = $("<tr></tr>");
		row.append($("<td></td>").html(`${grp.display} (<em>prob: ${grp_prob}</em>)`));
		row.append($("<td></td>").addClass("text-center").text(grp_count));

		for (var j = 0; j < groups.length; j++) {
			let grp2 = db.groups.find(x => { return x.code == groups[j]; });
			let grp_pred = matrix.find(x => x.Reference == grp.code && x.Prediction === grp2.code);
			let grp_pred_perc = matrixPercentages.find(x => x.Reference == grp.code && x.Prediction === grp2.code);
	
			if (grp_pred && grp_pred_perc) {
				row.append($("<td></td>")
					.addClass("text-center")
					.text(`${grp_pred.Freq} (${grp_pred_perc.Freq}%)`));
			}
		}

		matrix_body.append(row);
	}


	// export information
	$("#results-app-version").html("v" + localStorage.getItem('version'));

	// fill in properties from Case Info if not loaded from file
	if (!json.hasOwnProperty('properties')) {
		json['properties'] = {};
		json['properties']['case_number'] = $("#case_number_input").val();
		json['properties']['observation_date'] = $("#observation_date_input").val();
		json['properties']['analyst'] = $("#analyst_input").val();
	}

	//if (fullJson != null) {
		$("#results-case-number").html(json['properties']['case_number']);
		$("#results-observation-date").html(json['properties']['observation_date']);
		$("#results-analyst").html(json['properties']['analyst']);
	//}

	// handle messaging
	$("#analysis-pending").hide();
	$("#analysis-loading").hide();
	$("#analysis-error").hide();
	$("#analysis-results").show();
	enable_button("save-button");
}

function enable_button(id) {
	$("#" + id).removeAttr("disabled").removeClass("disabled");
}

function disable_button(id) {
	$("#" + id).attr("disabled", "disabled").addClass("disabled");
}

function export_to_pdf() {
	var today = new Date();
	var date = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
	var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
	var dateTime = date + ' ' + time;

	$("#results-export-on").html(dateTime);
	
	window.print();
	return;
}

function get_group_name(key) {
	//var groups = window.appdb['groups'];
	var groups = JSON.parse(localStorage.getItem("db")).groups;
	key = key.trim();
	for (var i = 0; i < groups.length; i++) {
		if (groups[i].code === key) {
			return groups[i].display;
		}
	}
	return key;
}

function get_trait_name(key) {
	//var traits = window.appdb['traits'];
	let traits = JSON.parse(localStorage.getItem("db")).traits;
	key = key.trim();
	for (var i = 0; i < traits.length; i++) {
		if (traits[i].abbreviation === key) {
			return traits[i].name;
		}
	}
	return key;
}

function trackEvent(category, action, label, value) {
	
}

function trackScreenView(screenName) {
	
}

function trackTime(category, variable, time, label) {
	
}

function trackException(description, fatal) {
	
}