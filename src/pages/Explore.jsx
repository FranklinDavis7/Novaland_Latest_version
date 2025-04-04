import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion"; // Added AnimatePresence
import { ethers } from "ethers";
import { supabase } from "../../supabase"; // Verify path
import {
	FiHome,
	FiMapPin,
	FiTag,
	FiUser,
	FiLoader,
	FiAlertCircle,
    FiFilter, // Added Filter icon
    FiX, // Added X icon for clearing
    FiDollarSign, // Added DollarSign icon
    FiChevronLeft, // Added Arrow icons
    FiChevronRight
} from "react-icons/fi";

import contractABI from "./../../contractABI2.json"; // Verify path and content
// --- !!! IMPORTANT: REPLACE WITH YOUR DEPLOYED Novaland_F2 CONTRACT ADDRESS !!! ---
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <-- Replace if necessary

const DEFAULT_PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/300x200.png?text=No+Image";
const propertiesPerPage = 12; // Moved pagination constant up

// Global error setter (Consider Context API for robustness)
let setErrorMsgGlobal = () => {};

// --- Contract Loading Logic (Keep as is) ---
async function loadContract() {
     if (contractAddress === "YOUR_NOVALAND_F2_CONTRACT_ADDRESS") { console.error("Explore: Placeholder contract address detected."); setErrorMsgGlobal("Config Error: Contract address needs update."); return null; }
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) { console.error("Explore: Invalid or missing contract address:", contractAddress); setErrorMsgGlobal("Config Error: Invalid contract address."); return null; }
     if (!contractABI || contractABI.length === 0) { console.error("Explore: Invalid or missing contract ABI."); setErrorMsgGlobal("Config Error: Invalid contract ABI."); return null; }
    if (!window.ethereum) { console.warn("Explore: MetaMask not found."); setErrorMsgGlobal("MetaMask not found. Please install it."); return null;}
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(contractAddress, contractABI, provider);
        try { await contract.propertyIndex(); console.log("Explore: Connection OK."); }
        catch (readError) { console.error("Explore: Failed contract read.", readError); setErrorMsgGlobal("Failed contract connection. Check network/details."); return null; }
        return contract;
    } catch (error) { console.error("Explore: Error loading contract instance:", error); setErrorMsgGlobal(`Error initializing contract: ${error.message}`); return null; }
}

// --- Property Fetching Logic (Keep as is) ---
async function fetchProperties() {
    const contract = await loadContract();
    if (!contract) { console.error("Explore: Contract instance unavailable for fetch."); return []; }
    try {
        console.log("Explore: Fetching properties...");
        const allPropertiesData = await contract.FetchProperties();
        const processedProperties = allPropertiesData
            .map((propertyStruct, structIndex) => {
                 if (!propertyStruct || typeof propertyStruct !== 'object' || !propertyStruct.productID) { console.warn(`Explore: Skipping invalid struct ${structIndex}`); return null; }
                try {
                    const images = Array.isArray(propertyStruct.images) ? propertyStruct.images : [];
                    const location = Array.isArray(propertyStruct.location) ? propertyStruct.location : [];
                    const priceWei = propertyStruct.price;
                    let formattedPrice = 'N/A';
                    let priceNumber = null;
                    if (priceWei && ethers.BigNumber.isBigNumber(priceWei)) {
                        formattedPrice = ethers.utils.formatEther(priceWei);
                        try { priceNumber = parseFloat(formattedPrice); }
                        catch(e) { console.warn(`Could not parse price ${formattedPrice} to float`); }
                    } else { console.warn(`Explore: Invalid price format ${structIndex}`); }
                    return {
                        productID: propertyStruct.productID.toString(), owner: propertyStruct.owner, price: formattedPrice, priceNumeric: priceNumber,
                        propertyTitle: propertyStruct.propertyTitle || "Untitled", category: propertyStruct.category || "Uncategorized",
                        images: images, location: location, description: propertyStruct.description || "",
                        nftId: propertyStruct.nftId || 'N/A', isListed: propertyStruct.isListed,
                        image: images.length > 0 ? images[0] : DEFAULT_PLACEHOLDER_IMAGE_URL,
                        displayLocation: location.length >= 3 ? `${location[2]}, ${location[1]}` : (location.length > 0 ? location.join(', ') : "N/A"),
                        city: location.length >= 3 ? location[2] : null,
                    };
                } catch (mapError) { console.error(`Explore: Error processing struct ${structIndex}`, mapError); return null; }
            })
            .filter(p => p !== null && p.isListed === true); // Filter listed properties here
        console.log(`Explore: Found ${processedProperties.length} listed properties.`);
        // Sort by ID descending (newest first)
        processedProperties.sort((a, b) => Number(b.productID) - Number(a.productID));
        return processedProperties;
    } catch (error) {
        console.error("Explore: Error fetching properties:", error);
        if (error.code === 'CALL_EXCEPTION') { setErrorMsgGlobal("Error fetching. Check network/contract."); }
        else { setErrorMsgGlobal(`Fetch error: ${error.message}`); }
        return [];
    }
}


// --- Main Explore Component ---
function Explore() {
    const [selectedType, setSelectedType] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("");
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });
    const [allProperties, setAllProperties] = useState([]); // Holds all fetched listed properties
    const [currentProperties, setCurrentProperties] = useState([]); // Holds filtered properties
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsgState, setErrorMsgState] = useState("");
    const [uniqueCities, setUniqueCities] = useState([]);
    const [showMobileFilters, setShowMobileFilters] = useState(false); // State for mobile filter visibility

     useEffect(() => { setErrorMsgGlobal = setErrorMsgState; return () => { setErrorMsgGlobal = () => {}; }; }, []);

    // Fetch data on mount
    const fetchInitialData = useCallback(async () => {
        setIsLoading(true); setErrorMsgState(""); setAllProperties([]); setCurrentProperties([]); setUniqueCities([]);
        try {
            const fetchedProperties = await fetchProperties(); // Already sorted by newest
            setAllProperties(fetchedProperties); setCurrentProperties(fetchedProperties); // Initialize with all fetched
            const cities = new Set(fetchedProperties.map(p => p.city).filter(Boolean)); // Extract unique cities
            setUniqueCities(['All Locations', ...Array.from(cities).sort()]); // Create sorted city list
            if (fetchedProperties.length === 0 && !errorMsgState) { console.log("Explore: Fetch OK, 0 listed properties found."); }
        } catch (error) { if (!errorMsgState) { setErrorMsgState(`Failed to load properties: ${error.message}`); } setAllProperties([]); setCurrentProperties([]); setUniqueCities([]); }
        finally { setIsLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Removed errorMsgState from deps

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

    // --- Filtering Logic ---
    useEffect(() => {
        if (isLoading || errorMsgState) return; // Don't filter if loading or error

        const minPrice = priceRange.min !== '' ? parseFloat(priceRange.min) : null;
        const maxPrice = priceRange.max !== '' ? parseFloat(priceRange.max) : null;

        const filtered = allProperties.filter((property) => {
            const typeMatch = !selectedType || property.category.toLowerCase() === selectedType.toLowerCase();
            const locationMatch = !selectedLocation || selectedLocation === 'All Locations' || property.city === selectedLocation;
            const priceNumeric = property.priceNumeric;
            let priceMatch = true;
            if (priceNumeric !== null) {
                if (minPrice !== null && priceNumeric < minPrice) priceMatch = false;
                if (maxPrice !== null && priceNumeric > maxPrice) priceMatch = false;
            } else {
                if (minPrice !== null || maxPrice !== null) priceMatch = false; // Exclude N/A price if filter active
            }
            return typeMatch && locationMatch && priceMatch;
        });

        setCurrentProperties(filtered);
        setCurrentPage(1); // Reset to first page after filtering

    }, [selectedType, selectedLocation, priceRange, allProperties, isLoading, errorMsgState]);


    // --- Event Handlers ---
    const handleTypeSelection = (type) => { setSelectedType(prev => prev === type ? "" : type); };
    const handleLocationSelection = (location) => { setSelectedLocation(location); };
    const handlePriceChange = (e) => {
        const { name, value } = e.target;
        if (/^\d*\.?\d*$/.test(value)) { setPriceRange(prev => ({ ...prev, [name]: value })); }
    };
    const clearPriceFilter = () => { setPriceRange({ min: '', max: '' }); };
    const clearAllFilters = () => {
        setSelectedType("");
        setSelectedLocation("");
        setPriceRange({ min: '', max: '' });
    };

    // --- Pagination Calculation ---
    const displayedProperties = currentProperties.slice((currentPage - 1) * propertiesPerPage, currentPage * propertiesPerPage);
    const totalPages = Math.ceil(currentProperties.length / propertiesPerPage);
    const propertyTypes = ["Apartment", "House", "Land", "Commercial"]; // Example types


    // --- Motion Variants ---
    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (i) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: i * 0.05, // Stagger effect
                duration: 0.4
            }
        })
    };

    const sidebarVariants = {
        hidden: { x: "-100%", opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { type: "tween", duration: 0.3 } },
        exit: { x: "-100%", opacity: 0, transition: { type: "tween", duration: 0.3 } }
    };

    // Component for rendering filters (reusable for mobile overlay)
    const FilterControls = ({ isMobile = false }) => (
        <>
            {/* Property Type Filter */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-violet-800 mb-3 flex items-center">
                    <FiTag className="mr-2 text-pink-500" size={18}/> Property Type
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    {propertyTypes.map((type) => (
                        <button
                            key={type}
                            onClick={() => handleTypeSelection(type)}
                            // Enhanced button styling with gradients
                            className={`w-full p-2.5 text-sm rounded-lg transition-all duration-300 border-2 ${
                                selectedType === type
                                ? "bg-gradient-to-r from-pink-500 to-violet-600 text-white border-transparent font-semibold shadow-md ring-2 ring-pink-300 ring-offset-1"
                                : "bg-white text-violet-700 border-violet-200 hover:border-pink-400 hover:bg-pink-50"
                            } focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-1`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
                {selectedType && (
                     <button onClick={() => handleTypeSelection("")} className="mt-2 w-full p-1.5 text-xs text-center text-red-600 hover:bg-red-100 rounded-md border border-red-200 font-medium flex items-center justify-center gap-1">
                        <FiX size={12}/> Clear Type
                     </button>
                )}
            </div>

            {/* Price Filter UI */}
             <div className="mb-6">
                <h3 className="text-lg font-semibold text-violet-800 mb-3 flex items-center">
                    <FiDollarSign className="mr-2 text-pink-500" size={18}/> Price Range (ETH)
                </h3>
                <div className="flex items-center space-x-2">
                     <input
                        type="text" name="min" placeholder="Min" value={priceRange.min} onChange={handlePriceChange} pattern="\d*\.?\d*"
                        className="w-1/2 p-2.5 text-sm border-violet-200 rounded-lg shadow-sm focus:ring-pink-400 focus:border-pink-400 focus:ring-1"
                    />
                     <span className="text-gray-400">-</span>
                     <input
                        type="text" name="max" placeholder="Max" value={priceRange.max} onChange={handlePriceChange} pattern="\d*\.?\d*"
                        className="w-1/2 p-2.5 text-sm border-violet-200 rounded-lg shadow-sm focus:ring-pink-400 focus:border-pink-400 focus:ring-1"
                    />
                </div>
                {(priceRange.min || priceRange.max) && (
                     <button onClick={clearPriceFilter} className="mt-2 w-full p-1.5 text-xs text-center text-red-600 hover:bg-red-100 rounded-md border border-red-200 font-medium flex items-center justify-center gap-1">
                        <FiX size={12}/> Clear Price
                    </button>
                )}
             </div>

            {/* Location Filter */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-violet-800 mb-3 flex items-center">
                    <FiMapPin className="mr-2 text-pink-500" size={18}/> Location (City)
                </h3>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1"> {/* Added max-height and scroll */}
                    {uniqueCities.length > 0 ? uniqueCities.map((city) => (
                         <button
                            key={city}
                            onClick={() => handleLocationSelection(city)}
                            className={`w-full p-2.5 text-left text-sm rounded-lg transition-all duration-300 border-2 truncate ${
                                selectedLocation === city
                                ? "bg-gradient-to-r from-pink-500 to-violet-600 text-white border-transparent font-semibold shadow-md ring-2 ring-pink-300 ring-offset-1"
                                : "bg-white text-violet-700 border-violet-200 hover:border-pink-400 hover:bg-pink-50"
                            } focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-1`}
                            title={city}
                        >
                            {city}
                        </button>
                     )) : isLoading ? ( <p className="text-sm text-violet-500 italic p-2">Loading locations...</p> ) : ( !errorMsgState && <p className="text-sm text-violet-500 italic p-2">No locations found.</p> )}
                </div>
                {selectedLocation && selectedLocation !== 'All Locations' && (
                    <button onClick={() => handleLocationSelection("")} className="mt-2 w-full p-1.5 text-xs text-center text-red-600 hover:bg-red-100 rounded-md border border-red-200 font-medium flex items-center justify-center gap-1">
                       <FiX size={12}/> Clear Location
                   </button>
                )}
            </div>

            {/* Clear All Filters Button */}
            {(selectedType || selectedLocation || priceRange.min || priceRange.max) && (
                 <button
                    onClick={clearAllFilters}
                    className="w-full p-2.5 text-sm rounded-lg transition-all duration-300 border-2 font-semibold mt-4 bg-gradient-to-r from-pink-100 to-violet-100 text-violet-700 border-violet-300 hover:from-pink-500 hover:to-violet-600 hover:text-white hover:border-transparent shadow hover:shadow-md flex items-center justify-center gap-1"
                 >
                   <FiX size={16}/> Clear All Filters
                 </button>
            )}
        </>
    );


    return (
        // Enhanced main background
        <div className="flex flex-col md:flex-row p-4 md:p-6 min-h-screen bg-gradient-to-br from-pink-50/50 via-violet-100/60 to-purple-200/50">

             {/* Mobile Filter Button (fixed position) */}
             <button
                onClick={() => setShowMobileFilters(true)}
                className="md:hidden fixed bottom-4 right-4 z-40 p-3 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-full shadow-lg hover:from-pink-600 hover:to-violet-700 transition-all duration-300"
                aria-label="Open Filters"
             >
                 <FiFilter size={24} />
             </button>

             {/* Mobile Filter Overlay */}
             <AnimatePresence>
                {showMobileFilters && (
                    <motion.div
                        key="mobile-filters"
                        variants={sidebarVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="md:hidden fixed inset-0 z-50 bg-white p-6 overflow-y-auto shadow-xl"
                    >
                         <div className="flex justify-between items-center mb-6 pb-3 border-b border-violet-200">
                            <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600">Filters</h2>
                             <button onClick={() => setShowMobileFilters(false)} className="p-1 text-violet-500 hover:text-pink-600">
                                <FiX size={28} />
                            </button>
                         </div>
                         <FilterControls isMobile={true} />
                         <button
                            onClick={() => setShowMobileFilters(false)}
                            className="mt-8 w-full p-3 bg-gradient-to-r from-pink-500 to-violet-600 text-white rounded-lg font-semibold shadow hover:shadow-md"
                        >
                            Apply Filters
                        </button>
                    </motion.div>
                )}
             </AnimatePresence>


            {/* Desktop Sidebar - Enhanced Styling */}
            <aside className="hidden md:block w-full md:w-1/4 lg:w-1/5 p-5 bg-gradient-to-b from-white via-violet-50 to-pink-50 rounded-xl shadow-lg mb-6 md:mb-0 md:mr-6 border border-violet-200/80 max-h-[calc(100vh-4rem)] overflow-y-auto sticky top-6">
                {/* Sticky Header inside sidebar */}
                <div className="sticky top-0 bg-gradient-to-b from-white via-violet-50/90 to-pink-50/80 backdrop-blur-sm z-10 -mx-5 px-5 pt-4 pb-3 mb-4 border-b border-violet-200">
                     <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600 flex items-center">
                        <FiFilter className="mr-2 text-violet-500" size={22}/> Filter Properties
                    </h2>
                </div>
                <FilterControls />
            </aside>

            {/* Main Content Area */}
            <main className="w-full md:w-3/4 lg:w-4/5">
                {/* Header Section - Enhanced */}
                <header className="p-5 w-full h-auto text-left mb-6 bg-white rounded-xl shadow-md border border-violet-100 flex flex-wrap justify-between items-center gap-y-2">
                     <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-violet-800">Explore Properties</h1>
                         <p className="text-gray-500 text-xs mt-1">
                             {isLoading ? "Loading properties..." : errorMsgState ? "Could not load data." : currentProperties.length > 0 ? `Showing ${displayedProperties.length} of ${currentProperties.length} results` : allProperties.length === 0 ? "No properties available yet." : "No properties match your current filters."}
                        </p>
                     </div>
                     {/* Active Filters Display - Enhanced Badges */}
                     <div className="flex flex-wrap gap-1.5 items-center">
                        {selectedType && <span className="text-xs bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800 px-2.5 py-1 rounded-full font-medium shadow-sm">Type: {selectedType}</span>}
                        {selectedLocation && selectedLocation !== 'All Locations' && <span className="text-xs bg-gradient-to-r from-violet-100 to-violet-200 text-violet-800 px-2.5 py-1 rounded-full font-medium shadow-sm">Loc: {selectedLocation}</span>}
                        {(priceRange.min || priceRange.max) && (
                            <span className="text-xs bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 px-2.5 py-1 rounded-full font-medium shadow-sm">
                                Price: {priceRange.min || '0'} - {priceRange.max || 'Any'} ETH
                            </span>
                        )}
                    </div>
                </header>

                {/* Loading/Error/No Data States - Enhanced */}
                {isLoading && (
                     <div className="flex justify-center items-center h-64 text-violet-600 font-semibold text-xl p-10">
                        <FiLoader className="animate-spin mr-3" size={28} /> Loading Properties...
                    </div>
                 )}
                 {!isLoading && errorMsgState && (
                     <div className="text-center text-red-700 bg-red-100/70 backdrop-blur-sm p-5 rounded-lg font-semibold border border-red-200 flex flex-col items-center space-y-3 max-w-lg mx-auto">
                        <FiAlertCircle className="w-7 h-7 text-red-600"/>
                         <p>{errorMsgState}</p>
                         <button onClick={fetchInitialData} className="mt-1 px-5 py-1.5 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-full text-sm hover:from-pink-600 hover:to-red-600 shadow hover:shadow-md">Try Again</button>
                     </div>
                 )}
                 {!isLoading && !errorMsgState && currentProperties.length === 0 && (
                     <div className="text-center text-violet-700/80 p-10 bg-violet-50 rounded-lg shadow-inner border border-violet-100 max-w-lg mx-auto">
                         {allProperties.length === 0 ? "There are currently no properties listed." : "No properties match your selected filters. Try adjusting them!"}
                     </div>
                 )}

                {/* Properties Grid - Enhanced Cards with Animation */}
                {!isLoading && !errorMsgState && currentProperties.length > 0 && (
                    <>
                        <motion.div
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" // Slightly smaller gap
                            layout // Animate layout changes
                        >
                             <AnimatePresence>
                                {displayedProperties.map((p, index) => {
                                    const image = p.image || DEFAULT_PLACEHOLDER_IMAGE_URL;
                                    const key = p.productID || p.nftId || `prop-${index}`;
                                    return (
                                        <motion.div
                                            key={key}
                                            variants={cardVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="hidden" // Optional: Animate removal
                                            custom={index} // Pass index for stagger
                                            layoutId={key} // Ensures smooth animation if items reorder
                                            className="bg-white shadow-lg hover:shadow-xl rounded-xl overflow-hidden cursor-pointer transition-all duration-300 border border-violet-100/80 flex flex-col group ring-1 ring-transparent hover:ring-pink-300/50 hover:-translate-y-1"
                                        >
                                            {/* Image container */}
                                             <div className="relative h-48 w-full overflow-hidden">
                                                <img src={image} alt={p.propertyTitle} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onError={(e) => { if (e.target.src !== DEFAULT_PLACEHOLDER_IMAGE_URL) e.target.src = DEFAULT_PLACEHOLDER_IMAGE_URL; }} />
                                                {/* Category Badge */}
                                                <span className="absolute top-2.5 right-2.5 bg-gradient-to-tr from-pink-500 to-violet-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md uppercase tracking-wide">
                                                    {p.category}
                                                </span>
                                             </div>
                                            {/* Content */}
                                            <div className="p-4 flex-grow flex flex-col">
                                                <h2 className="font-bold text-base text-violet-900 mb-1 truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-pink-600 group-hover:to-violet-600 transition-colors" title={p.propertyTitle}>{p.propertyTitle}</h2>
                                                <p className="text-[11px] text-pink-600/80 flex items-center mb-2" title={p.displayLocation}><FiMapPin className="mr-1 text-pink-400 flex-shrink-0" size={11} /> <span className="truncate">{p.displayLocation || 'N/A'}</span></p>
                                                <p className="text-violet-800 font-bold text-lg mt-auto pt-2">{p.price !== 'N/A' ? `${p.price} ETH` : 'N/A'}</p>
                                            </div>
                                             {/* View Details Button - Themed */}
                                             <Link
                                                to={`/property/${p.productID}`}
                                                className="block w-full text-center bg-gradient-to-r from-violet-50 to-pink-50 text-sm font-semibold py-2.5 px-4 text-violet-700 hover:text-white hover:from-violet-600 hover:to-pink-500 transition-all duration-300 border-t border-violet-100"
                                             >
                                                View Details
                                             </Link>
                                        </motion.div>
                                    );
                                })}
                             </AnimatePresence>
                        </motion.div>

                        {/* Pagination - Enhanced */}
                         {totalPages > 1 && (
                             <nav className="flex justify-center items-center mt-10 pt-5 border-t border-violet-200/80 space-x-3" aria-label="Pagination">
                                <button
                                    className="p-2 bg-white text-violet-600 rounded-full shadow-md hover:bg-gradient-to-r hover:from-pink-500 hover:to-violet-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-violet-400 transition-all duration-300"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    aria-label="Previous Page"
                                >
                                    <FiChevronLeft size={20} />
                                </button>
                                <span className="px-4 py-2 text-sm text-violet-800 font-medium bg-violet-100/70 rounded-full shadow-inner">Page {currentPage} of {totalPages}</span>
                                <button
                                    className="p-2 bg-white text-violet-600 rounded-full shadow-md hover:bg-gradient-to-r hover:from-pink-500 hover:to-violet-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-violet-400 transition-all duration-300"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    aria-label="Next Page"
                                >
                                    <FiChevronRight size={20} />
                                </button>
                            </nav>
                         )}
                    </>
                )}
            </main>
        </div>
    );
}

export default Explore;