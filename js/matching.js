/* ============================================================
   MATCHING.JS — CampusFinds AI-Powered Matching
   ============================================================ */

const AI_SERVER_URL = "http://192.168.100.23:5000";
var currentUploadedImage = null;

document.addEventListener("DOMContentLoaded", function() {
    console.log("=== MATCHING.JS LOADED ===");
    
    var findBtn = document.querySelector(".ai-action-btn");
    if (findBtn) {
        console.log("Found button, attaching click handler");
        findBtn.addEventListener("click", handleAnalysisClick);
    } else {
        console.error("Button .ai-action-btn NOT FOUND!");
    }

    var uploadInput = document.getElementById('aiImageInput');
    if (uploadInput) {
        console.log("Found upload input, attaching change handler");
        uploadInput.addEventListener('change', handleFileSelect);
    } else {
        console.error("Upload input #aiImageInput NOT FOUND!");
    }

    // Load initial matches
    loadAIMatches();
});

/* ═══════════════════════════════════════════════════════════
   FILE UPLOAD HANDLER
   ═══════════════════════════════════════════════════════════ */

function handleFileSelect(e) {
    console.log("=== FILE SELECTED ===", e.target.files);
    
    var file = e.target.files[0];
    if (!file) {
        console.log("No file selected");
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert("Please select an image file (PNG, JPG, JPEG)");
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Maximum size is 5MB.");
        return;
    }
    
    console.log("File details:", {
        name: file.name,
        size: file.size,
        type: file.type
    });
    
    var reader = new FileReader();
    reader.onload = function(event) {
        currentUploadedImage = event.target.result;
        console.log("Image loaded to memory, base64 length:", currentUploadedImage.length);
        
        // Show preview
        showImagePreview(currentUploadedImage);
        
        // Auto-run analysis after short delay
        setTimeout(function() {
            analyzeUploadedImage(file.name);
        }, 100);
    };
    reader.onerror = function(err) {
        console.error("FileReader error:", err);
        alert("Error reading file. Please try again.");
    };
    reader.readAsDataURL(file);
}

function showImagePreview(base64Image) {
    var inner = document.getElementById('aiUploadInner');
    var preview = document.getElementById('aiImagePreview');
    
    if (inner) inner.style.display = 'none';
    if (preview) {
        preview.style.display = 'block';
        preview.src = base64Image;
    }
}

function handleAnalysisClick() {
    console.log("=== BUTTON CLICKED ===");
    console.log("currentUploadedImage exists:", !!currentUploadedImage);
    
    if (currentUploadedImage) {
        var fileInput = document.getElementById('aiImageInput');
        var filename = fileInput.files[0] ? fileInput.files[0].name : "uploaded-image.jpg";
        console.log("Running uploaded image analysis for:", filename);
        analyzeUploadedImage(filename);
    } else {
        console.log("No upload, running batch analysis");
        runBatchAIAnalysis();
    }
}

/* ═══════════════════════════════════════════════════════════
   UPLOADED IMAGE ANALYSIS
   ═══════════════════════════════════════════════════════════ */

async function analyzeUploadedImage(filename) {
    console.log("=== STARTING ANALYZE UPLOADED IMAGE ===");
    
    if (!currentUploadedImage) {
        alert("Please upload an image first!");
        return;
    }
    
    var container = document.getElementById("matchContainer");
    if (!container) {
        console.error("matchContainer not found!");
        return;
    }
    
    container.innerHTML = "<p style='opacity:0.6;text-align:center;margin-top:20px'>AI analyzing your image...</p>";
    
    try {
        // Get all reports
        console.log("Fetching reports from database...");
        var reports = await getAllReports() || [];
        console.log("Total reports fetched:", reports.length);
        
        if (reports.length === 0) {
            container.innerHTML = "<p style='text-align:center;margin-top:20px'>No items in database yet.</p>";
            return;
        }
        
        // Filter for FOUND items with images
        var foundItems = reports.filter(function(r) {
            var type = (r.reporttype || r.reportType || "").toString().toLowerCase().trim();
            var hasImage = !!(r.imageurl || r.imageUrl);
            return type === "found" && hasImage;
        });
        
        console.log("Found items after filter:", foundItems.length);
        
        if (foundItems.length === 0) {
            container.innerHTML = 
                "<div style='text-align:center; margin-top:20px; padding:20px; background:rgba(255,193,7,0.1); border-radius:8px;'>" +
                    "<p style='color:#ffc107;'><b>No found items available</b></p>" +
                    "<p style='font-size:12px; opacity:0.7;'>Total reports: " + reports.length + "</p>" +
                    "<button onclick='findTextMatches()' style='margin-top:10px; padding:10px 20px; background:var(--gold); border:none; border-radius:8px; cursor:pointer;'>" +
                        "Show Text Matches Instead" +
                    "</button>" +
                "</div>";
            return;
        }
        
        container.innerHTML = "<p style='opacity:0.6;text-align:center;margin-top:20px'>Comparing with " + foundItems.length + " found items...</p>";
        
        var matches = [];
        var errors = [];
        
        // Compare with each found item
        for (var i = 0; i < foundItems.length; i++) {
            var found = foundItems[i];
            var foundImageUrl = found.imageurl || found.imageUrl;
            
            console.log(`Comparing with item #${i + 1}/${foundItems.length}:`, found.item);
            
            container.innerHTML = `<p style='opacity:0.6;text-align:center;margin-top:20px'>Analyzing ${i + 1}/${foundItems.length}: ${escHtml(found.item)}</p>`;
            
            try {
                var requestBody = {
                    uploaded_image: currentUploadedImage,
                    found_image_url: foundImageUrl,
                    found_item_name: found.item,
                    found_description: found.description || ''
                };
                
                console.log("Sending request to AI server...");
                
                var response = await fetch(`${AI_SERVER_URL}/api/compare-upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                
                console.log("Response status:", response.status);
                
                if (!response.ok) {
                    var errorText = await response.text();
                    throw new Error(`Server error ${response.status}: ${errorText}`);
                }
                
                var result = await response.json();
                console.log("Response data:", result);
                
                if (result.success && result.analysis) {
                    console.log("Match result:", found.item, "=", result.analysis.confidence + "%");
                    matches.push({
                        found: found,
                        confidence: result.analysis.confidence,
                        reason: result.analysis.reason,
                        match: result.analysis.match,
                        full_response: result.analysis.full_response
                    });
                } else {
                    console.error("Analysis failed for", found.item, ":", result.error);
                    errors.push({ item: found.item, error: result.error });
                }
            } catch (err) {
                console.error("Error comparing with", found.item, ":", err);
                errors.push({ item: found.item, error: err.message });
            }
        }
        
        console.log("Analysis complete:", matches.length, "matches,", errors.length, "errors");
        
        // Sort by confidence (highest first)
        matches.sort(function(a, b) { return b.confidence - a.confidence; });
        
        // Show results
        displayUploadMatches(matches, filename, foundItems.length, errors);
        
    } catch (err) {
        console.error("CRITICAL ERROR in analyzeUploadedImage:", err);
        container.innerHTML = `<p style='color:#f87171;text-align:center;margin-top:20px'>Error: ${escHtml(err.message)}</p>`;
    }
}

function displayUploadMatches(matches, filename, totalCompared, errors) {
    console.log("Displaying results:", matches.length, "matches");
    
    var container = document.getElementById("matchContainer");
    container.innerHTML = "";
    
    // Header with uploaded image
    var header = document.createElement("div");
    header.style.cssText = "text-align:center; margin-bottom:20px; padding:20px; background:rgba(91,200,245,0.1); border-radius:12px; border:2px solid var(--blue);";
    header.innerHTML = 
        "<div style='margin-bottom:15px;'>" +
            "<img src='" + currentUploadedImage + "' style='max-width:250px; max-height:200px; border-radius:10px; object-fit:cover; border:3px solid var(--blue); box-shadow:0 4px 20px rgba(91,200,245,0.3);'>" +
        "</div>" +
        "<h3 style='margin:0 0 5px; color:var(--gold);'>Your Uploaded Image</h3>" +
        "<p style='margin:0; opacity:0.8;'>" + escHtml(filename) + "</p>" +
        "<p style='margin:5px 0 0; font-size:12px; opacity:0.6;'>Compared with " + totalCompared + " found items</p>";
    container.appendChild(header);
    
    // Show errors if any
    if (errors.length > 0) {
        var errorDiv = document.createElement("div");
        errorDiv.style.cssText = "margin-bottom:20px; padding:15px; background:rgba(248,113,113,0.1); border-radius:8px; border:1px solid rgba(248,113,113,0.3);";
        errorDiv.innerHTML = 
            "<p style='color:#f87171; margin:0;'><b>" + errors.length + " comparison(s) failed</b></p>" +
            "<p style='font-size:12px; opacity:0.7; margin:5px 0 0;'>Check console for details</p>";
        container.appendChild(errorDiv);
    }
    
    if (matches.length === 0) {
        container.innerHTML += 
            "<div style='text-align:center; padding:30px; background:rgba(255,193,7,0.1); border-radius:12px; border:1px solid rgba(255,193,7,0.3);'>" +
                "<p style='color:#ffc107; font-size:18px;'><b>No matches found</b></p>" +
                "<p style='opacity:0.7;'>Try uploading a clearer image or use text search</p>" +
            "</div>";
    } else {
        // Show top 5 matches with click-to-expand
        var topMatches = matches.slice(0, 5);
        
        topMatches.forEach(function(match, index) {
            var found = match.found;
            var foundUser = found.User || found.user || {};
            var confidence = match.confidence;
            var isMatch = match.match;
            
            // Colors based on confidence level
            var borderColor, bgColor, statusText, statusColor, badgeIcon;
            
            if (confidence >= 80) {
                borderColor = "#22c55e";
                bgColor = "rgba(34,197,94,0.08)";
                statusText = "STRONG MATCH";
                statusColor = "#22c55e";
                badgeIcon = "HIGH";
            } else if (confidence >= 60) {
                borderColor = "#eab308";
                bgColor = "rgba(234,179,8,0.08)";
                statusText = "GOOD MATCH";
                statusColor = "#eab308";
                badgeIcon = "MED";
            } else if (confidence >= 40) {
                borderColor = "#3b82f6";
                bgColor = "rgba(59,130,246,0.08)";
                statusText = "POSSIBLE MATCH";
                statusColor = "#3b82f6";
                badgeIcon = "LOW";
            } else {
                borderColor = "#6b7280";
                bgColor = "rgba(107,114,128,0.08)";
                statusText = "LOW MATCH";
                statusColor = "#6b7280";
                badgeIcon = "NO";
            }
            
            var card = document.createElement("div");
            card.className = "match-card";
            card.style.cssText = "border: 3px solid " + borderColor + "; margin-bottom: 25px; background:" + bgColor + "; border-radius:16px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.3); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;";
            card.setAttribute('data-match-index', index);
            
            // Hover effect
            card.onmouseenter = function() {
                this.style.transform = "translateY(-4px)";
                this.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)";
            };
            card.onmouseleave = function() {
                this.style.transform = "translateY(0)";
                this.style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)";
            };
            
            // Click to show details
            card.onclick = function() {
                showMatchDetails(match, index);
            };
            
            // Build the card content - NO EMOJIS, REMOVED "confidence" TEXT
            var cardHTML = 
                // Header with MATCH result and confidence
                "<div style='background: " + borderColor + "25; padding: 15px 20px; text-align:center; border-bottom:2px solid " + borderColor + ";'>" +
                    "<div style='display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:8px;'>" +
                        "<span style='font-size:16px; font-weight:bold; color:" + statusColor + "; padding:4px 12px; background:rgba(0,0,0,0.3); border-radius:12px;'>" + badgeIcon + "</span>" +
                        "<h2 style='margin:0; color:" + statusColor + "; font-size:18px; font-weight:bold;'>" + statusText + "</h2>" +
                    "</div>" +
                    "<div style='background:rgba(0,0,0,0.3); padding:10px 20px; border-radius:20px; display:inline-block;'>" +
                        "<span style='font-size:32px; font-weight:bold; color:#fff;'>" + confidence + "%</span>" +
                        "<span style='font-size:14px; color:" + statusColor + "; margin-left:5px;'>match</span>" +
                    "</div>" +
                    "<p style='margin:8px 0 0; font-size:12px; opacity:0.7;'>Click for full AI analysis</p>" +
                "</div>" +
                
                // SIDE BY SIDE IMAGES
                "<div style='display:flex; gap:15px; padding:20px; align-items:stretch; background:rgba(0,0,0,0.2);'>" +
                    // Your upload
                    "<div style='flex:1; text-align:center; padding:15px; background:rgba(59,130,246,0.1); border-radius:12px; border:2px solid #3b82f6;'>" +
                        "<p style='font-size:14px; color:#3b82f6; margin-bottom:12px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;'>YOUR UPLOAD</p>" +
                        "<img src='" + currentUploadedImage + "' style='width:100%; height:180px; object-fit:cover; border-radius:10px; border:3px solid #3b82f6; box-shadow:0 4px 15px rgba(59,130,246,0.3);'>" +
                    "</div>" +
                    
                    // VS
                    "<div style='display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 10px;'>" +
                        "<div style='font-size:24px; opacity:0.5; font-weight:bold; color:#fff;'>VS</div>" +
                    "</div>" +
                    
                    // Found item
                    "<div style='flex:1; text-align:center; padding:15px; background:rgba(34,197,94,0.1); border-radius:12px; border:2px solid #22c55e;'>" +
                        "<p style='font-size:14px; color:#22c55e; margin-bottom:12px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;'>FOUND ITEM</p>" +
                        "<img src='" + escHtml(found.imageurl || found.imageUrl) + "' style='width:100%; height:180px; object-fit:cover; border-radius:10px; border:3px solid #22c55e; box-shadow:0 4px 15px rgba(34,197,94,0.3);' onerror=\"this.style.display='none'\">" +
                        "<h3 style='margin:15px 0 5px; font-size:18px; color:#fff;'>" + escHtml(found.item) + "</h3>" +
                        "<p style='margin:0; font-size:13px; opacity:0.7;'>" + escHtml(found.location) + "</p>" +
                        "<p style='margin:5px 0 0; font-size:12px; opacity:0.5;'>by " + escHtml(foundUser.name || 'Unknown') + "</p>" +
                    "</div>" +
                "</div>" +
                
                // AI REASON (preview)
                "<div style='padding:20px; background:rgba(0,0,0,0.3);'>" +
                    "<h4 style='margin:0 0 15px; color:var(--gold); font-size:16px; border-bottom:2px solid var(--gold); padding-bottom:8px; display:inline-block;'>AI Analysis Preview</h4>" +
                    "<div style='background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; border-left:4px solid var(--gold); font-size:14px; line-height:1.6; color:#e2e8f0;'>" +
                        escHtml(truncateText(match.reason || "No detailed reason provided.", 150)) +
                    "</div>" +
                "</div>";
            
            // Add contact button only if it's a decent match
            if (isMatch && confidence >= 50) {
                cardHTML += 
                    "<div style='padding:0 20px 20px;'>" +
                        "<button onclick='event.stopPropagation(); contactMatch(\"\",\"" + escHtml(foundUser.email || '') + "\")' " +
                            "style='width:100%; padding:15px; background:linear-gradient(135deg, var(--gold), #d97706); border:none; border-radius:10px; color:#000; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 15px rgba(245,158,11,0.4);'>" +
                            "Contact Finder: " + escHtml(foundUser.name || 'Unknown') +
                        "</button>" +
                    "</div>";
            }
            
            card.innerHTML = cardHTML;
            container.appendChild(card);
        });
    }
    
    // Footer buttons
    var btnDiv = document.createElement("div");
    btnDiv.style.cssText = "text-align:center; margin-top:30px; padding:20px;";
    btnDiv.innerHTML = 
        "<button onclick='clearUpload()' style='padding:15px 30px; background:rgba(248,113,113,0.2); border:2px solid rgba(248,113,113,0.4); border-radius:10px; color:#f87171; cursor:pointer; margin-right:15px; font-weight:bold; font-size:14px;'>" +
            "Clear & Upload New Image" +
        "</button>" +
        "<button onclick='runBatchAIAnalysis()' style='padding:15px 30px; background:rgba(91,200,245,0.2); border:2px solid var(--blue); border-radius:10px; color:var(--blue); cursor:pointer; font-weight:bold; font-size:14px;'>" +
            "Analyze All Database Items" +
        "</button>";
    container.appendChild(btnDiv);
}

function truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}

function showMatchDetails(match, index) {
    var found = match.found;
    var foundUser = found.User || found.user || {};
    var confidence = match.confidence;
    var fullResponse = match.full_response || match.reason || "No full response available";
    
    // Create modal overlay
    var modal = document.createElement("div");
    modal.id = "matchDetailModal";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center; padding:20px; overflow-y:auto;";
    
    // Determine colors based on confidence
    var borderColor, statusColor, statusText;
    if (confidence >= 80) {
        borderColor = "#22c55e";
        statusColor = "#22c55e";
        statusText = "STRONG MATCH";
    } else if (confidence >= 60) {
        borderColor = "#eab308";
        statusColor = "#eab308";
        statusText = "GOOD MATCH";
    } else if (confidence >= 40) {
        borderColor = "#3b82f6";
        statusColor = "#3b82f6";
        statusText = "POSSIBLE MATCH";
    } else {
        borderColor = "#6b7280";
        statusColor = "#6b7280";
        statusText = "LOW MATCH";
    }
    
    modal.innerHTML = 
        "<div style='background:linear-gradient(135deg, #1e293b, #0f172a); border:3px solid " + borderColor + "; border-radius:20px; max-width:800px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 25px 50px rgba(0,0,0,0.5);'>" +
            // Header - REMOVED "confidence" TEXT
            "<div style='background:" + borderColor + "20; padding:25px; text-align:center; border-bottom:2px solid " + borderColor + "; position:relative;'>" +
                "<button onclick='closeMatchModal()' style='position:absolute; top:15px; right:15px; background:rgba(248,113,113,0.2); border:2px solid rgba(248,113,113,0.4); color:#f87171; width:40px; height:40px; border-radius:50%; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;'>X</button>" +
                "<h2 style='margin:0 0 10px; color:" + statusColor + "; font-size:28px; font-weight:bold;'>" + statusText + "</h2>" +
                "<div style='background:rgba(0,0,0,0.4); padding:15px 30px; border-radius:30px; display:inline-flex; align-items:center; gap:10px;'>" +
                    "<span style='font-size:48px; font-weight:bold; color:#fff;'>" + confidence + "%</span>" +
                    "<span style='font-size:18px; color:" + statusColor + ";'>match</span>" +
                "</div>" +
            "</div>" +
            
            // Content
            "<div style='padding:25px;'>" +
                // Images comparison
                "<div style='display:flex; gap:20px; margin-bottom:25px; flex-wrap:wrap;'>" +
                    "<div style='flex:1; min-width:250px; text-align:center; padding:20px; background:rgba(59,130,246,0.1); border-radius:12px; border:2px solid #3b82f6;'>" +
                        "<p style='font-size:16px; color:#3b82f6; margin-bottom:15px; font-weight:bold;'>YOUR UPLOADED IMAGE</p>" +
                        "<img src='" + currentUploadedImage + "' style='width:100%; max-height:250px; object-fit:cover; border-radius:10px; border:3px solid #3b82f6;'>" +
                    "</div>" +
                    "<div style='flex:1; min-width:250px; text-align:center; padding:20px; background:rgba(34,197,94,0.1); border-radius:12px; border:2px solid #22c55e;'>" +
                        "<p style='font-size:16px; color:#22c55e; margin-bottom:15px; font-weight:bold;'>FOUND ITEM</p>" +
                        "<img src='" + escHtml(found.imageurl || found.imageUrl) + "' style='width:100%; max-height:250px; object-fit:cover; border-radius:10px; border:3px solid #22c55e;' onerror=\"this.style.display='none'\">" +
                        "<h3 style='margin:15px 0 5px; color:#fff;'>" + escHtml(found.item) + "</h3>" +
                        "<p style='margin:0; opacity:0.7;'>" + escHtml(found.location) + "</p>" +
                        "<p style='margin:5px 0 0; font-size:14px; opacity:0.5;'>by " + escHtml(foundUser.name || 'Unknown') + "</p>" +
                    "</div>" +
                "</div>" +
                
                // Full AI Response
                "<div style='background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.1); overflow:hidden;'>" +
                    "<div style='background:var(--gold); color:#000; padding:15px 20px; font-weight:bold; font-size:16px;'>Full AI Analysis & Reasoning</div>" +
                    "<div style='padding:20px; background:rgba(0,0,0,0.2);'>" +
                        "<pre style='margin:0; white-space:pre-wrap; word-wrap:break-word; font-family:inherit; font-size:14px; line-height:1.8; color:#e2e8f0;'>" + escHtml(fullResponse) + "</pre>" +
                    "</div>" +
                "</div>" +
                
                // Summary reason
                "<div style='margin-top:20px; padding:20px; background:" + borderColor + "10; border-radius:12px; border-left:4px solid " + borderColor + ";'>" +
                    "<h4 style='margin:0 0 10px; color:" + borderColor + ";'>Summary</h4>" +
                    "<p style='margin:0; font-size:15px; line-height:1.6; color:#e2e8f0;'>" + escHtml(match.reason || "No summary available.") + "</p>" +
                "</div>" +
            "</div>" +
            
            // Footer with contact button
            "<div style='padding:0 25px 25px; text-align:center;'>" +
                (confidence >= 40 ? 
                    "<button onclick='contactMatch(\"\",\"" + escHtml(foundUser.email || '') + "\")' style='padding:15px 40px; background:linear-gradient(135deg, var(--gold), #d97706); border:none; border-radius:10px; color:#000; font-weight:bold; font-size:18px; cursor:pointer; box-shadow:0 4px 20px rgba(245,158,11,0.4);'>" +
                        "Contact " + escHtml(foundUser.name || 'Finder') +
                    "</button>" :
                    "<p style='color:#6b7280; font-style:italic;'>Confidence too low for automatic contact</p>"
                ) +
            "</div>" +
        "</div>";
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeMatchModal();
        }
    };
    
    // Close on Escape key
    document.onkeydown = function(e) {
        if (e.key === "Escape") {
            closeMatchModal();
        }
    };
}

function closeMatchModal() {
    var modal = document.getElementById("matchDetailModal");
    if (modal) {
        modal.remove();
    }
    document.onkeydown = null;
}

function clearUpload() {
    console.log("Clearing upload");
    currentUploadedImage = null;
    
    var fileInput = document.getElementById('aiImageInput');
    if (fileInput) fileInput.value = '';
    
    var inner = document.getElementById('aiUploadInner');
    var preview = document.getElementById('aiImagePreview');
    if (inner) inner.style.display = 'flex';
    if (preview) {
        preview.style.display = 'none';
        preview.src = '';
    }
    
    var container = document.getElementById("matchContainer");
    if (container) {
        container.innerHTML = "<p style='opacity:0.6;text-align:center;margin-top:20px'>Upload an image to find matches</p>";
    }
}

/* ═══════════════════════════════════════════════════════════
   BATCH ANALYSIS (Database Lost vs Found)
   ═══════════════════════════════════════════════════════════ */

async function runBatchAIAnalysis() {
    console.log("Running batch analysis");
    var container = document.getElementById("matchContainer");
    if (!container) return;
    
    container.innerHTML = "<p style='opacity:0.6;text-align:center;margin-top:20px'>AI analyzing all database items...</p>";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        
        const response = await fetch(`${AI_SERVER_URL}/api/batch-analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        console.log("Batch response:", data);
        
        if (!data.success) {
            throw new Error(data.error || "AI analysis failed");
        }
        
        container.innerHTML = `<p style='text-align:center;margin-top:20px'>Analyzed ${data.analyzed} combinations. Found ${data.high_confidence_matches} high confidence matches.</p>`;
        
        // Reload matches display
        await loadAIMatches();
        
    } catch (err) {
        console.error("Batch error:", err);
        if (err.name === 'AbortError') {
            container.innerHTML = "<div style='text-align:center; margin-top:20px; padding:20px;'><p style='color:#f87171;'>Analysis timed out (5 minutes)</p><button onclick='findTextMatches()' style='padding:10px 20px; background:var(--gold); border:none; border-radius:8px; cursor:pointer;'>Use Text Matching</button></div>";
        } else {
            container.innerHTML = `<div style='text-align:center; margin-top:20px; padding:20px;'><p style='color:#f87171;'>${escHtml(err.message)}</p><button onclick='findTextMatches()' style='padding:10px 20px; background:var(--gold); border:none; border-radius:8px; cursor:pointer;'>Use Text Matching</button></div>`;
        }
    }
}

/* ═══════════════════════════════════════════════════════════
   LOAD AI MATCHES FROM DATABASE
   ═══════════════════════════════════════════════════════════ */

async function loadAIMatches() {
    console.log("Loading AI matches");
    var container = document.getElementById("matchContainer");
    if (!container) return;
    
    container.innerHTML = "<p style='opacity:0.6;text-align:center;margin-top:20px'>Loading AI matches from database...</p>";

    try {
        // Get matches with confidence >= 60% (only show good matches)
        const response = await fetch(`${AI_SERVER_URL}/api/matches?min_confidence=60`);
        const data = await response.json();
        console.log("Loaded matches:", data);
        
        if (data.success && data.matches && data.matches.length > 0) {
            displayDatabaseMatches(data.matches);
        } else {
            console.log("No AI matches found, falling back to text matching");
            await findTextMatches();
        }
        
    } catch (err) {
        console.log("AI server unavailable, using text matching:", err);
        await findTextMatches();
    }
}

/* ═══════════════════════════════════════════════════════════
   DISPLAY DATABASE MATCHES - NO EMOJIS, PERCENTAGE BADGES, CLICKABLE
   ═══════════════════════════════════════════════════════════ */

function displayDatabaseMatches(matches) {
    var container = document.getElementById("matchContainer");
    container.innerHTML = "";
    
    // Filter matches - only show if confidence >= 60%
    var goodMatches = matches.filter(function(m) {
        return m.confidence_score >= 60;
    });
    
    if (goodMatches.length === 0) {
        container.innerHTML = "<p style='text-align:center;margin-top:20px;opacity:0.7;'>No high-confidence AI matches found. Try text matching instead.</p>";
        return;
    }
    
    var header = document.createElement("div");
    header.style.cssText = "text-align:center; margin-bottom:20px; padding:15px; background:rgba(91,200,245,0.1); border-radius:8px;";
    header.innerHTML = "<b>AI Database Matches</b> • " + goodMatches.length + " potential matches found";
    container.appendChild(header);

    goodMatches.forEach(function(match) {
        var lost = match.lost;
        var found = match.found;
        if (!lost || !found) return;
        
        var lostUser = lost.user || {};
        var foundUser = found.user || {};
        var confidence = match.confidence_score;
        var reason = match.reason || "No detailed reason available";
        
        // Determine colors based on confidence - PERCENTAGE BADGES
        var borderColor, bgColor, statusText, statusColor;
        if (confidence >= 85) {
            borderColor = "#22c55e";  // Green
            bgColor = "rgba(34,197,94,0.08)";
            statusText = "EXCELLENT MATCH";
            statusColor = "#22c55e";
        } else if (confidence >= 70) {
            borderColor = "#eab308";  // Yellow
            bgColor = "rgba(234,179,8,0.08)";
            statusText = "STRONG MATCH";
            statusColor = "#eab308";
        } else {
            borderColor = "#3b82f6";  // Blue
            bgColor = "rgba(59,130,246,0.08)";
            statusText = "GOOD MATCH";
            statusColor = "#3b82f6";
        }

        var card = document.createElement("div");
        card.className = "match-card";
        card.style.cssText = "border: 2px solid " + borderColor + "; margin-bottom: 20px; background:" + bgColor + "; border-radius:16px; overflow:hidden; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;";
        
        // Hover effect
        card.onmouseenter = function() {
            this.style.transform = "translateY(-3px)";
            this.style.boxShadow = "0 12px 40px rgba(0,0,0,0.3)";
        };
        card.onmouseleave = function() {
            this.style.transform = "translateY(0)";
            this.style.boxShadow = "none";
        };
        
        // Click to show details
        card.onclick = function() {
            showDatabaseMatchDetails(match);
        };
        
        // Card content - SHOW PERCENTAGE INSTEAD OF EMOJIS, NO EMOJIS IN CONTENT, REMOVED "confidence" TEXT
        card.innerHTML = 
            // Header with percentage badge
            "<div style='background: " + borderColor + "20; padding: 15px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid " + borderColor + ";'>" +
                "<span style='font-weight:bold; color:" + statusColor + "; font-size:16px;'>" + statusText + "</span>" +
                "<div style='background:rgba(0,0,0,0.4); padding:8px 16px; border-radius:20px;'>" +
                    "<span style='font-size:24px; font-weight:bold; color:#fff;'>" + confidence + "%</span>" +
                    "<span style='font-size:14px; color:" + statusColor + "; margin-left:5px;'>match</span>" +
                "</div>" +
            "</div>" +
            
            // Content - side by side, NO EMOJIS
            "<div style='display:flex; gap:15px; padding:20px;'>" +
                // Lost item
                "<div style='flex:1; text-align:center;'>" +
                    "<h3 style='color:#f87171; margin-bottom:10px; font-size:14px; text-transform:uppercase;'>Lost Item</h3>" +
                    (lost.imageurl ? "<img src='" + escHtml(lost.imageurl) + "' style='width:100%; height:120px; object-fit:cover; border-radius:8px; margin-bottom:10px;' onerror=\"this.style.display='none'\">" : "") +
                    "<p style='font-weight:bold; font-size:16px; margin:0;'>" + escHtml(lost.item) + "</p>" +
                    "<p style='font-size:12px; opacity:0.7; margin:5px 0 0;'>" + escHtml(lost.location) + "</p>" +
                    "<p style='font-size:11px; opacity:0.5; margin:3px 0 0;'>by " + escHtml(lostUser.name || 'Unknown') + "</p>" +
                "</div>" +
                
                // VS indicator - text only
                "<div style='display:flex; flex-direction:column; justify-content:center; align-items:center; padding:0 10px;'>" +
                    "<div style='font-size:24px; opacity:0.5; font-weight:bold; color:#fff;'>VS</div>" +
                "</div>" +
                
                // Found item
                "<div style='flex:1; text-align:center;'>" +
                    "<h3 style='color:#22c55e; margin-bottom:10px; font-size:14px; text-transform:uppercase;'>Found Item</h3>" +
                    (found.imageurl ? "<img src='" + escHtml(found.imageurl) + "' style='width:100%; height:120px; object-fit:cover; border-radius:8px; margin-bottom:10px;' onerror=\"this.style.display='none'\">" : "") +
                    "<p style='font-weight:bold; font-size:16px; margin:0;'>" + escHtml(found.item) + "</p>" +
                    "<p style='font-size:12px; opacity:0.7; margin:5px 0 0;'>" + escHtml(found.location) + "</p>" +
                    "<p style='font-size:11px; opacity:0.5; margin:3px 0 0;'>by " + escHtml(foundUser.name || 'Unknown') + "</p>" +
                "</div>" +
            "</div>" +
            
            // AI Reason preview, NO EMOJIS
            "<div style='padding:0 20px 15px;'>" +
                "<div style='background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; font-size:13px; margin-bottom:10px; border-left:3px solid " + borderColor + ";'>" +
                    "<b style='color:" + borderColor + ";'>AI Analysis:</b> " + escHtml(truncateText(reason, 120)) +
                "</div>" +
                "<p style='text-align:center; font-size:12px; opacity:0.6; margin:0;'>Click for full details</p>" +
            "</div>";
        
        container.appendChild(card);
    });
}

function showDatabaseMatchDetails(match) {
    var lost = match.lost;
    var found = match.found;
    var lostUser = lost.user || {};
    var foundUser = found.user || {};
    var confidence = match.confidence_score;
    var reason = match.reason || "No detailed reason provided";
    
    // Create modal overlay
    var modal = document.createElement("div");
    modal.id = "dbMatchDetailModal";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center; padding:20px; overflow-y:auto;";
    
    // Determine colors based on confidence
    var borderColor, statusText;
    if (confidence >= 85) {
        borderColor = "#22c55e";
        statusText = "EXCELLENT MATCH";
    } else if (confidence >= 70) {
        borderColor = "#eab308";
        statusText = "STRONG MATCH";
    } else {
        borderColor = "#3b82f6";
        statusText = "GOOD MATCH";
    }
    
    modal.innerHTML = 
        "<div style='background:linear-gradient(135deg, #1e293b, #0f172a); border:3px solid " + borderColor + "; border-radius:20px; max-width:800px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 25px 50px rgba(0,0,0,0.5);'>" +
            // Header - NO EMOJIS, REMOVED "confidence" TEXT
            "<div style='background:" + borderColor + "20; padding:25px; text-align:center; border-bottom:2px solid " + borderColor + "; position:relative;'>" +
                "<button onclick='closeDbMatchModal()' style='position:absolute; top:15px; right:15px; background:rgba(248,113,113,0.2); border:2px solid rgba(248,113,113,0.4); color:#f87171; width:40px; height:40px; border-radius:50%; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;'>X</button>" +
                "<h2 style='margin:0 0 10px; color:" + borderColor + "; font-size:28px; font-weight:bold;'>" + statusText + "</h2>" +
                "<div style='background:rgba(0,0,0,0.4); padding:15px 30px; border-radius:30px; display:inline-flex; align-items:center; gap:10px;'>" +
                    "<span style='font-size:48px; font-weight:bold; color:#fff;'>" + confidence + "%</span>" +
                    "<span style='font-size:18px; color:" + borderColor + ";'>match</span>" +
                "</div>" +
            "</div>" +
            
            // Content - NO EMOJIS
            "<div style='padding:25px;'>" +
                // Lost item details - NO EMOJIS
                "<div style='margin-bottom:20px; padding:20px; background:rgba(248,113,113,0.1); border-radius:12px; border:2px solid rgba(248,113,113,0.3);'>" +
                    "<h3 style='margin:0 0 15px; color:#f87171; font-size:18px;'>Lost Item Details</h3>" +
                    "<div style='display:flex; gap:15px; flex-wrap:wrap;'>" +
                        (lost.imageurl ? "<img src='" + escHtml(lost.imageurl) + "' style='width:150px; height:150px; object-fit:cover; border-radius:10px;'>" : "") +
                        "<div style='flex:1; min-width:200px;'>" +
                            "<p style='margin:0 0 8px; font-size:22px; font-weight:bold; color:#fff;'>" + escHtml(lost.item) + "</p>" +
                            "<p style='margin:0 0 5px; opacity:0.8;'>Location: " + escHtml(lost.location) + "</p>" +
                            "<p style='margin:0 0 5px; opacity:0.7;'>By: " + escHtml(lostUser.name || 'Unknown') + "</p>" +
                            "<p style='margin:0 0 5px; opacity:0.6; font-size:14px;'>" + escHtml(lostUser.email || 'No email') + "</p>" +
                            (lost.description ? "<p style='margin:10px 0 0; opacity:0.7; font-style:italic; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px;'>\" " + escHtml(lost.description) + " \"</p>" : "") +
                        "</div>" +
                    "</div>" +
                "</div>" +
                
                // Found item details - NO EMOJIS
                "<div style='margin-bottom:20px; padding:20px; background:rgba(34,197,94,0.1); border-radius:12px; border:2px solid rgba(34,197,94,0.3);'>" +
                    "<h3 style='margin:0 0 15px; color:#22c55e; font-size:18px;'>Found Item Details</h3>" +
                    "<div style='display:flex; gap:15px; flex-wrap:wrap;'>" +
                        (found.imageurl ? "<img src='" + escHtml(found.imageurl) + "' style='width:150px; height:150px; object-fit:cover; border-radius:10px;'>" : "") +
                        "<div style='flex:1; min-width:200px;'>" +
                            "<p style='margin:0 0 8px; font-size:22px; font-weight:bold; color:#fff;'>" + escHtml(found.item) + "</p>" +
                            "<p style='margin:0 0 5px; opacity:0.8;'>Location: " + escHtml(found.location) + "</p>" +
                            "<p style='margin:0 0 5px; opacity:0.7;'>By: " + escHtml(foundUser.name || 'Unknown') + "</p>" +
                            "<p style='margin:0 0 5px; opacity:0.6; font-size:14px;'>" + escHtml(foundUser.email || 'No email') + "</p>" +
                            (found.description ? "<p style='margin:10px 0 0; opacity:0.7; font-style:italic; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px;'>\" " + escHtml(found.description) + " \"</p>" : "") +
                        "</div>" +
                    "</div>" +
                "</div>" +
                
                // AI Analysis - NO EMOJIS
                "<div style='background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.1); overflow:hidden;'>" +
                    "<div style='background:" + borderColor + "; color:#000; padding:15px 20px; font-weight:bold; font-size:16px;'>Full AI Analysis</div>" +
                    "<div style='padding:20px; background:rgba(0,0,0,0.2);'>" +
                        "<p style='margin:0; font-size:15px; line-height:1.8; color:#e2e8f0; white-space:pre-wrap;'>" + escHtml(reason) + "</p>" +
                    "</div>" +
                "</div>" +
            "</div>" +
            
            // Footer with contact button - NO EMOJIS
            "<div style='padding:0 25px 25px; text-align:center;'>" +
                "<button onclick='contactMatch(\"" + escHtml(lostUser.email||'') + "\", \"" + escHtml(foundUser.email||'') + "\")' style='padding:15px 40px; background:linear-gradient(135deg, var(--gold), #d97706); border:none; border-radius:10px; color:#000; font-weight:bold; font-size:18px; cursor:pointer; box-shadow:0 4px 20px rgba(245,158,11,0.4);'>" +
                    "Contact Both Parties" +
                "</button>" +
            "</div>" +
        "</div>";
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeDbMatchModal();
        }
    };
    
    // Close on Escape key
    document.onkeydown = function(e) {
        if (e.key === "Escape") {
            closeDbMatchModal();
        }
    };
}

function closeDbMatchModal() {
    var modal = document.getElementById("dbMatchDetailModal");
    if (modal) {
        modal.remove();
    }
    document.onkeydown = null;
}

/* ═══════════════════════════════════════════════════════════
   TEXT MATCHING (FALLBACK) - STRICT FILTERING, NO IMPOSSIBLE MATCHES
   ═══════════════════════════════════════════════════════════ */

async function findTextMatches() {
    console.log("Running text matches");
    var container = document.getElementById("matchContainer");
    if (!container) return;
    container.innerHTML = "<p style='opacity:0.6;text-align:center;margin-top:20px'>Analyzing with text matching...</p>";

    var reports;
    try { 
        reports = await getAllReports() || []; 
    } catch(err) {
        container.innerHTML = "<p style='color:#f87171;text-align:center;margin-top:20px'>Failed to load: " + escHtml(err.message) + "</p>";
        return;
    }

    function getType(r) { return (r.reporttype || r.reportType || "").toLowerCase(); }
    function getImg(r)  { return r.imageurl || r.imageUrl || null; }

    var lostItems  = reports.filter(function(r){ return getType(r)==="lost"; });
    var foundItems = reports.filter(function(r){ return getType(r)==="found"; });

    console.log("Text matching - Lost:", lostItems.length, "Found:", foundItems.length);

    container.innerHTML = "";
    var matchCount = 0;

    lostItems.forEach(function(lost) {
        foundItems.forEach(function(found) {
            var score = matchScore(lost, found);
            // STRICT FILTER: Only show if score >= 2 (category + at least one other match)
            // This prevents showing "laptop vs tennis ball" as possible match
            if (score < 2) return;
            matchCount++;

            var lostUser  = lost.User  || lost.user  || {};
            var foundUser = found.User || found.user || {};
            var lostImg   = getImg(lost);
            var foundImg  = getImg(found);
            
            // Calculate percentage-like score for display (2=75%, 3=95%)
            var displayPercent = score === 3 ? 95 : 75;
            var statusLabel = scoreLabel(score);
            var statusColor = score === 3 ? "#22c55e" : "#eab308";
            var borderColor = statusColor;

            var card = document.createElement("div");
            card.className = "match-card";
            card.style.cssText = "border: 2px solid " + borderColor + "; margin-bottom: 20px; background:rgba(0,0,0,0.2); border-radius:16px; overflow:hidden;";
            
            card.innerHTML =
                // Header with percentage badge - NO EMOJIS, REMOVED "confidence" TEXT
                "<div style='background: " + borderColor + "20; padding: 15px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid " + borderColor + ";'>" +
                    "<span style='font-weight:bold; color:" + statusColor + "; font-size:16px;'>" + statusLabel + "</span>" +
                    "<div style='background:rgba(0,0,0,0.4); padding:8px 16px; border-radius:20px;'>" +
                        "<span style='font-size:24px; font-weight:bold; color:#fff;'>" + displayPercent + "%</span>" +
                        "<span style='font-size:14px; color:" + statusColor + "; margin-left:5px;'>match</span>" +
                    "</div>" +
                "</div>" +
                
                // Content - side by side, NO EMOJIS
                "<div style='display:flex; gap:15px; padding:20px;'>" +
                    // Lost item
                    "<div style='flex:1; text-align:center;'>" +
                        "<h3 style='color:#f87171; margin-bottom:10px; font-size:14px; text-transform:uppercase;'>Lost Item</h3>" +
                        (lostImg ? "<img src='" + escHtml(lostImg) + "' style='width:100%; height:120px; object-fit:cover; border-radius:8px; margin-bottom:10px;' onerror=\"this.style.display='none'\">" : "") +
                        "<p style='font-weight:bold; font-size:16px; margin:0;'>" + escHtml(lost.item) + "</p>" +
                        "<p style='font-size:12px; opacity:0.7; margin:5px 0 0;'>" + escHtml(lost.location) + "</p>" +
                        "<p style='font-size:11px; opacity:0.5; margin:3px 0 0;'>by " + escHtml(lostUser.name || "Unknown") + "</p>" +
                    "</div>" +
                    
                    // VS indicator - text only
                    "<div style='display:flex; flex-direction:column; justify-content:center; align-items:center; padding:0 10px;'>" +
                        "<div style='font-size:24px; opacity:0.5; font-weight:bold; color:#fff;'>VS</div>" +
                    "</div>" +
                    
                    // Found item
                    "<div style='flex:1; text-align:center;'>" +
                        "<h3 style='color:#22c55e; margin-bottom:10px; font-size:14px; text-transform:uppercase;'>Found Item</h3>" +
                        (foundImg ? "<img src='" + escHtml(foundImg) + "' style='width:100%; height:120px; object-fit:cover; border-radius:8px; margin-bottom:10px;' onerror=\"this.style.display='none'\">" : "") +
                        "<p style='font-weight:bold; font-size:16px; margin:0;'>" + escHtml(found.item) + "</p>" +
                        "<p style='font-size:12px; opacity:0.7; margin:5px 0 0;'>" + escHtml(found.location) + "</p>" +
                        "<p style='font-size:11px; opacity:0.5; margin:3px 0 0;'>by " + escHtml(foundUser.name || "Unknown") + "</p>" +
                    "</div>" +
                "</div>" +
                
                // Match details - NO EMOJIS
                "<div style='padding:0 20px 15px;'>" +
                    "<div style='background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; font-size:13px; margin-bottom:10px; border-left:3px solid " + borderColor + ";'>" +
                        "<b style='color:" + borderColor + ";'>Match Details:</b> " + 
                        "Category: " + ((lost.category||"").toLowerCase()===(found.category||"").toLowerCase() ? "Match" : "Different") + 
                        " | Location: " + ((lost.location||"").toLowerCase()===(found.location||"").toLowerCase() ? "Match" : "Different") +
                        " | Name: " + (function(){ var l=(lost.item||"").toLowerCase(), f=(found.item||"").toLowerCase(); return (l&&f&&(l.includes(f)||f.includes(l))) ? "Similar" : "Different"; })() +
                    "</div>" +
                "</div>" +
                
                // Contact button - NO EMOJIS
                "<div style='padding:0 20px 20px;'>" +
                    "<button onclick=\\\"contactMatch('" + escHtml(lostUser.email||"") + "','" + escHtml(foundUser.email||"") + "')\\\" style='width:100%; padding:15px; background:linear-gradient(135deg, var(--gold), #d97706); border:none; border-radius:10px; color:#000; font-weight:bold; font-size:16px; cursor:pointer;'>" +
                        "Contact Both Parties" +
                    "</button>" +
                "</div>";

            container.appendChild(card);
        });
    });

    if (matchCount === 0) {
        container.innerHTML = "<p style='opacity:0.6;margin-top:20px;text-align:center'>No matches found yet. Items must be in the same category with matching location or name. Check back later.</p>";
    }
}

function matchScore(lost, found) {
    var score = 0;
    // Category must match for any consideration (prevents laptop vs tennis ball)
    if ((lost.category||"").toLowerCase()===(found.category||"").toLowerCase()) score++;
    if ((lost.location||"").toLowerCase()===(found.location||"").toLowerCase()) score++;
    var l = (lost.item||"").toLowerCase(), f = (found.item||"").toLowerCase();
    if (l && f && (l.includes(f)||f.includes(l))) score++;
    return score;
}

function scoreLabel(s) { 
    // NO EMOJIS - text only labels with percentage equivalents
    return s>=3 ? "STRONG MATCH" : s===2 ? "LIKELY MATCH" : "POSSIBLE MATCH"; 
}

function contactMatch(le, fe) {
    var emails = [le,fe].filter(Boolean).join(", ");
    if (emails) {
        window.location.href = "mailto:"+emails+"?subject=CampusFinds%3A%20Match&body=Hi%2C%20we%20found%20a%20match%20on%20CampusFinds.";
    } else { 
        alert("Contact emails not available."); 
    }
}

function escHtml(str) {
    return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}