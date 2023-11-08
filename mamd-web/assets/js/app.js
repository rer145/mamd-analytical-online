'use strict';
const MIN_SELECTIONS = 3;
const MIN_GROUPS = 3;	// nnet requires 2, but with 2 additional coding for ctab$byClass is required in R.

const API_URL = 'https://mamd-api.ikp55qn3sn7ek.us-east-2.cs.amazonlightsail.com/mamd?';
//const API_URL = 'http://localhost:8000/mamd?';

var probs_chart = null;

function show_app() {
	$("#section-setup").hide();
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

	$("#open-button").on('click', function(e) {
		e.preventDefault();
		trackEvent("Application", "Open File");
		open_case();
	});

	$("#save-button").on('click', function(e) {
		e.preventDefault();
		trackEvent("Application", "Save File");
		save_case();
	});

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

	$("#settings-rscript-button").on('change', function(e) {
		//console.log(document.getElementById("settings-rscript-button").files[0].path);
		localStorage.setItem("app.rscript_path", document.getElementById("settings-rscript-button").files[0].path);
		$("#rscript-current-path").text(localStorage.getItem("app.rscript_path"));
		check_settings();
	});

	// $('a[data-toggle="tab"]').on('show.bs.tab', function(e) {
	// 	// console.log(e.target.id);
	// 	// console.log(e.relatedTarget.id);

	// });

	$("#settings-modal").on('show.bs.modal', function(e) {
		$("#rscript-current-path").text(localStorage.getItem("app.rscript_path"));

		if (store.has("settings.auto_check_for_updates")) {
			$("#settings-auto-update-check").prop("checked", Boolean(localStorage.getItem("settings.auto_check_for_updates")));
		} else {
			$("#settings-auto-update-check").prop("checked", true);
			localStorage.setItem("settings.auto_check_for_updates", true);
		}
		check_packages();
	});

	$(document).on('click', "#settings-auto-update-check", function(e) {
		localStorage.setItem("settings.auto_check_for_updates", $(this).is(':checked'));
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

	$(document).on('click', ".r-package-install-button", function(e) {
		e.preventDefault();

		var parent = $(this).parent();
		var pkg = $(this).attr("data-package");
		var badge = parent.find(".badge");

		var success = install_package(pkg, parent);

		if (success) {
			//verify_package_install(package);
			badge.removeClass("badge-danger")
				.addClass("badge-success")
				.html("Installed");

		} else {
			badge.removeClass("badge-success")
				.addClass("badge-danger")
				.html("Not Installed");
			// TODO: notify user of failed install
			//   message box?
		}
	});

	$(document).on('click', '#install-update-button', function(e) {
		e.preventDefault();
		//updater.performUpdate();
		trackEvent("Application", "Install Update");
		ipcRenderer.send('update-start');
	});

	$(document).on('click', '#dismiss-update-button', function(e) {
		e.preventDefault();
		trackEvent("Application", "Dismiss Update");
		$("#update-alert").hide();
	});

	$(document).on('click', '#view-pdf-button', function(e) {
		e.preventDefault();
		trackEvent("Application", "View PDF");
		shell.openExternal('file://' + $(this).attr("data-path"));
		$("#generic-alert").hide();
	});

	$('a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
		trackScreenView($(e.target).attr("id").replace("-tab", ""));
	});

	// ipcRenderer.on('userdata-path', (event, message) => {
	// 	//console.log('UserData Path: ' + message);
	// 	settings.set('config.userdata_path', message);
	// });
}

function app_preload() {
	$.get("assets/db/db.min.json").then((data) => { 
		localStorage.setItem("db", JSON.stringify(data));
		
		window.is_dirty = false;
		window.current_file = "";
		window.current_results = "";

		localStorage.setItem("version", "1.0.0");
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

	disable_button("export-results-pdf");
	disable_button("save-button");
	disable_button("open-button");
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

function search_for_rscript(path) {
	var span = $("#settings-found-rscript");
    find.file(/Rscript.exe/, path, function(files) {
		if (files.length > 0) {
			for (var i = 0; i < files.length; i++) {
				span.append(
					$("<a></a>")
						.attr("href", "#")
						.addClass("rscript-settings-link")
						.text(files[i])
						.on("click", function(e) {
							e.preventDefault();
							localStorage.setItem("app.rscript_path", $(this).text());
							check_settings();
						})
				).append($("<br></br>"));
			}
		}
	})
    .error(function(err) { console.error(err); });
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



function check_for_updates() {
	let checkForUpdates = true;
	if (store.has("settings.auto_check_for_updates")) {
		checkForUpdates = Boolean(localStorage.getItem("settings.auto_check_for_updates"));
	}

	if (checkForUpdates) {
		setTimeout(function() {
			ipcRenderer.send('update-check');
		}, 3000);
	}
}

function check_settings() {
	// TODO: if no rscript selected,
	//   go to settings tab
	//   disable run analysis button
	console.log("RPath", localStorage.getItem("app.rscript_path"));
	console.log("RPackageSource", localStorage.getItem("app.r_package_source_path"));
	if (localStorage.getItem("app.rscript_path") === undefined) {
		$("#settings-alert").show();
		disable_button("analysis-button");
		$('#tabs a[href="#settings"]').tab('show');
	} else {
		$("#settings-alert").hide();
		$('#tabs a[href="#analysis"]').tab('show');
		enable_button("analysis-button");
	}
}

function check_packages() {
	var div = $("#settings-r-packages");
	div.empty();

	$.each(requiredPackages, function(i, v) {
		//verify_package_install(v);
		var template = $("#r-package-template").clone();
		template.removeClass("template");
		template.removeAttr("id");

		template.find(".r-package-name").html(v);
		verify_package_install(v, template);
		div.append(template);
	});
}

function toggle_package_status(pkg, template, installed) {
	var badge = template.find(".badge");
	var button = template.find(".r-package-install-button");
	button.attr("data-package", pkg);

	if (installed) {
		badge.removeClass("badge-danger").addClass("badge-success").html("Installed");
		button.hide();
	} else {
		badge.removeClass("badge-success").addClass("badge-danger").html("Not Installed");
		button.show();
	}

	return template;
}

function show_suggested_rscript_paths() {
	var span = $("#settings-found-rscript");
	span.empty().html('<p class="loading">Loading suggested paths...</p>');

	//if (process.platform === "win32" || process.platform === "win64") {
	if (is.windows) {
		search_for_rscript('C:\\Program Files\\R');
		search_for_rscript('C:\\Program Files\\Microsoft\\R Open');
	}

	//if (process.platform === "darwin") {
	if (is.macos) {
        search_for_rscript('/Library/Frameworks/R.framework/Resources/bin');
		search_for_rscript('/usr/bin/Rscript');
        search_for_rscript("/Library/Frameworks/R.framework/Versions/3.5.1-MRO/Resources/bin/");
	}

	span.find("p.loading").remove();
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

// function toggleIsDirty() {
// 	if (window.is_dirty) {
// 		window.is_dirty = false;
// 		disable_button("save-button");
// 	} else {
// 		window.is_dirty = true;
// 		enable_button("save-button");
// 	}
// }

function generate_inputfile() {
	console.log("Generating input file...");
	console.log(window.selections);

	// var keys = ['Group'];
	// var values = ['Unknown'];
	// for (var key in window.selections) {
	// 	keys.push(key);
	// 	values.push(window.selections[key]);
	// }

	let qs = '';
	for (var key in window.selections) {
		qs += `&${key}=${window.selections[key]}`;
	}

	return qs;

	// var header = keys.join(",");
	// var inputs = values.join(",");

	// try {
	// 	var filepath = path.join(localStorage.getItem("user.analysis_path"), new Date().valueOf().toString() + "-input.csv");
	// 	fs.writeFileSync(filepath, header + '\n' + inputs + '\n');
	// 	return filepath;
	// } catch(err) {
	// 	trackException(err, true);
	// 	console.log(err);
	// 	return "";
	// }
}

function generate_outputfile(input_file) {
	// var ts = input_file.replace("-input.csv", "").replace(localStorage.getItem("user.analysis_path"), "");
	// var filepath = path.join(localStorage.getItem("user.analysis_path"), ts + "-output.txt");
	// return filepath;
	return "";
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
		//var output_file = generate_outputfile(input_file);
		var groups = window.groups.join();

		// console.log(querystring);
		// console.log(groups);

		//querystring = `group_list=${groups}${querystring}`;
		querystring = `group_list=American,African,Asian${querystring}`;
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
	// return fetch(`${API_URL}${querystring}`).then((response) => {
	// 	if (response.ok) return response.json();
	// 	return Promise.reject(response);
	// });

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

function show_results(fullJson, data) {
	var json = data;
	try {
		json = JSON.parse(data);
	} catch { }
	window.current_results = json;

	console.log(json);

	var pred = json['prediction'][0];
	var sens = json['sensitivity'][0];
	var spec = json['specificity'][0];
	var probs = json['probabilities'];
	var prob = 0;
	var stats = json['statistics'][0];
	var matrix = json['matrix'];
	var groups = window.groups; //window.appdb["groups"];
	//var traits = window.appdb["traits"];

	var db = JSON.parse(localStorage.getItem("db"));
	//var groups = db.groups;
	var traits = db.traits;

	// console.log(groups);
	// console.log(traits);
	// console.log(pred);
	// console.log(sens);
	// console.log(spec);
	// console.log(probs);
	// console.log(stats);
	// console.log(matrix);

	var acc = (parseFloat(stats['accuracy']) * 100).toFixed(2) + "%";
	var ci = "(" + parseFloat(stats['accuracyLower']).toFixed(4) + ", " + parseFloat(stats['accuracyUpper']).toFixed(4) + ")";
	var sensitivity = parseFloat(sens).toFixed(4);
	var specificity = parseFloat(spec).toFixed(4);

	$("#results-ancestry").text(get_group_name(pred));
	$("#results-accuracy").text(acc);
	$("#results-ci").text(ci);
	$("#results-sensitivity").text(sensitivity);
	$("#results-specificity").text(specificity);

	probs.sort(function(a, b) {
		return parseFloat(b.probability) - parseFloat(a.probability);
	});
	
	var probs_labels = [];
	var probs_data = [];
	for (var i = 0; i < probs.length; i++) {
		probs_labels.push(probs[i]["group"]);
		probs_data.push(Number(probs[i]["probability"]));

		if (Number(probs[i]["probability"]) > prob) {
			prob = Number(probs[i]["probability"]);
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
	matrix_head_row.append($("<th></th>"));

	for (var i = 0; i < groups.length; i++) {
		//let grp = window.appdb['groups'].find(x => { return x.code == groups[i]; });
		let grp = db.groups.find(x => { return x.code == groups[i]});
		matrix_head_row.append($("<th></th>").addClass("text-center").text(grp.display));
	}
	matrix_head.addClass("thead-dark").append(matrix_head_row);

	matrix_body.empty();
	for (var i = 0; i < groups.length; i++) {
		//let grp = window.appdb['groups'].find(x => { return x.code == groups[i]; });
		let grp = db.groups.find(x => { return x.code == groups[i]; });

		var row = $("<tr></tr>");
		row.append($("<td></td>").text(grp.display));

		var group_key_i = " " + grp.code + " ";
		for (var j = 0; j < groups.length; j++) {
			//let grp2 = window.appdb['groups'].find(x => { return x.code == groups[j]; });
			let grp2 = db.groups.find(x => { return x.code == groups[j]; });
			var group_key_j = " " + grp2.code + " ";
			var temp = "0";

			if (matrix[group_key_i]) {
				for (var k = 0; k < matrix[group_key_i].length; k++) {
					if (matrix[group_key_i][k].group === group_key_j) {
						temp = matrix[group_key_i][k].score;
					}
				}
			}

			row.append($("<td></td>").addClass("text-center").text(temp));
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

function install_package(pkg, template) {
	console.log('installing : ' + pkg);
	var analysis_path = localStorage.getItem("app.r_analysis_path");
	var r_script = path.join(analysis_path, "install_package.R");
	var parameters = [
		r_script,
		pkg
	];

	var options = {
		name: 'MaMD Analysis Subprocess'
	};
	var cmd = '"' + localStorage.getItem("app.rscript_path") + '"';
	$.each(parameters, function(i,v) {
		cmd = cmd + ' "' + v + '"';
	});

	exec.execFile(localStorage.getItem("app.rscript_path"), parameters,
		function(error, stdout, stderr) {
			console.error(error);
			console.log(stderr);
			toggle_package_status(pkg, template, false);
			return false;
		},
		function(stdout, stderr) {
			console.log('stdout:', JSON.stringify(stdout));
			console.log('stderr:', JSON.stringify(stderr));
			toggle_package_status(pkg, template, true);
			return true;
		});

	// exec.sudo(
	// 	cmd,
	// 	options,
	// 	function(error, stdout, stderr) {
	// 		console.error(error);
	// 		console.log(stderr);
	// 		toggle_package_status(pkg, template, false);
	// 		return false;
	// 	},
	// 	function(stdout, stderr) {
	// 		console.log('stdout:', JSON.stringify(stdout));
	// 		console.log('stderr:', JSON.stringify(stderr));
	// 		toggle_package_status(pkg, template, true);
	// 		return true;
	// 	});

	// sudo.exec(cmd, options,
	// 	function(error, stdout, stderr) {
	// 		if (error) {
	// 			console.error(error);
	// 			console.log(stderr);
	// 			toggle_package_status(pkg, template, false);
	// 			return false;
	// 		}
	// 		console.log('stdout: ' + JSON.stringify(stdout));
	// 		console.log('stderr: ' + JSON.stringify(stderr));
	// 		toggle_package_status(pkg, template, true);
	// 		return true;
	// 	}
	// );

	// proc.execFile(localStorage.getItem("app.rscript_path"), parameters, function(err, data) {
	// 	if(err){
	// 		console.error(err);
	// 		return false;
	// 	}
	// 	console.log("exec done");
	// 	return true;
	// });
}

function verify_package_install(pkg, template) {
	//console.log("Verifying package install: " + pkg);

	var proc = require('child_process');

	var analysis_path = localStorage.getItem("app.r_analysis_path");
	var r_script = path.join(analysis_path, "verify_package.R");
	var parameters = [
		r_script,
		pkg
	];

	var options = {
		name: 'MaMD Analysis Subprocess'
	};
	var cmd = '"' + localStorage.getItem("app.rscript_path") + '"';
	$.each(parameters, function(i,v) {
		cmd = cmd + ' "' + v + '"';
	});



	// exec.sudo(cmd, options,
	// 	function(error, stdout, stderr) {
	// 		console.error(error);
	// 		console.error(stdout);
	// 		console.error(stderr);
	// 		return false;
	// 	},
	// 	function(stdout, stderr) {
	// 		var output = JSON.stringify(stdout);
	// 		console.log("verify stdout:", output);
	// 		toggle_package_status(pkg, template, output.includes("TRUE"));
	// 	});

	// sudo.exec(cmd, options,
	// 	function(error, stdout, stderr) {
	// 		if (error) {
	// 			console.error(error);
	// 			console.error(stderr);
	// 			return false;
	// 		}
	// 		var output = JSON.stringify(stdout);
	// 		console.log("verify stdout: " + output);
	// 		toggle_package_status(pkg, template, output.includes("TRUE"));
	// 		// if (output.includes("TRUE"))
	// 		// 	return true;
	// 		// else
	// 		// 	return false;
	// 	}
	// );

	exec.execFile(localStorage.getItem("app.rscript_path"), parameters,
		function(error, stdout, stderr) {
			console.error(error);
			console.error(stdout);
			console.error(stderr);
			return false;
		},
		function(stdout, stderr) {
			var output = JSON.stringify(stdout);
			console.log("verify stdout:", output);
			toggle_package_status(pkg, template, output.includes("TRUE"));
		});

	// proc.execFile(localStorage.getItem("app.rscript_path"), parameters, function(err, data) {
	// 	if(err){
	// 		console.error(err);
	// 		return false;
	// 	} else {
	// 		//console.log(pkg + " INCLUDES FALSE: " + data.includes("FALSE"));
	// 		//console.log(pkg + " INCLUDES TRUE: " + data.includes("TRUE"));
	// 		if (data.includes("FALSE"))
	// 			return false;
	// 		if (data.includes("TRUE"))
	// 			return true;
	// 	}

	// 	// fallthrough
	// 	return false;
	// });

	//console.log("Done verifying " + pkg);
}

function export_to_pdf() {
	return;

	// var today = new Date();
	// var date = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
	// var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
	// var dateTime = date + ' ' + time;

	// $("#results-export-on").html(dateTime);

	// $("#generic-alert").removeClass()
	// 	.addClass("alert")
	// 	.addClass("alert-info")
	// 	.html("Please wait while the PDF file is being exported.")
	// 	.show();

	// ipcRenderer.send('pdf-export');
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