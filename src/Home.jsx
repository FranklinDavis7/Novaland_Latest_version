import React, { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { Link } from 'react-router-dom';
import contractABI from "./../contractABI2.json"; // Ensure this is the correct ABI for Novaland_F2
// Removed useAddress as it wasn't used in the final logic
import { Search, ExternalLink, MapPin, Loader, AlertCircle } from "lucide-react"; // Added some icons
import banner from "./assets/banner.png"; // Ensure path is correct

// --- !!! IMPORTANT: REPLACE WITH YOUR DEPLOYED Novaland_F2 CONTRACT ADDRESS !!! ---
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <-- Replace if necessary

const DEFAULT_PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/300x200.png?text=No+Image";
const LATEST_PROPERTIES_COUNT = 4; // Define how many "latest" properties to show

// --- Global error state setter (Consider using Context for better state management) ---
let setErrorMsg = () => {};

// Helper to load the contract instance
async function loadContract() {
	// Basic validation
	if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
		console.error("Invalid or missing contract address:", contractAddress);
		setErrorMsg("Configuration Error: Invalid contract address provided.");
		return null;
	}
	if (!contractABI || contractABI.length === 0) {
		 console.error("Invalid or missing contract ABI.");
		 setErrorMsg("Configuration Error: Invalid contract ABI provided.");
		 return null;
	}
	if (!window.ethereum) {
		console.error("MetaMask or compatible wallet not found.");
		setErrorMsg("Please install MetaMask or a compatible wallet.");
		return null;
	}

	try {
		const provider = new ethers.providers.Web3Provider(window.ethereum);
		const contract = new ethers.Contract(contractAddress, contractABI, provider);
		// Optional: Perform a simple read call to verify connection/ABI/address
		try {
			await contract.propertyIndex(); // Check if this function exists and is readable
			console.log("Contract connection verified.");
		} catch (readError) {
			 console.error("Failed initial read from contract. Check address, ABI, and network.", readError);
			 setErrorMsg("Failed to connect to the contract. Ensure you are on the correct network and contract details are correct.");
			 return null;
		}
		return contract;
	} catch (error) {
		console.error("Error loading contract instance:", error);
		 setErrorMsg(`Error initializing contract: ${error.message}`);
		return null;
	}
}

// --- Updated fetchProperties to fetch, filter, sort, and slice ---
async function fetchProperties() {
	const contract = await loadContract();
	if (!contract) {
		console.error("Contract instance is not available for fetching.");
		return [];
	}

	try {
		console.log("Fetching ALL properties from contract...");
		const allPropertiesData = await contract.FetchProperties();
		console.log(`Fetched ${allPropertiesData.length} raw property structs.`);

		// 1. Process and Map Raw Data
		let processedProperties = allPropertiesData
			.map((propertyStruct, structIndex) => {
				 if (!propertyStruct || typeof propertyStruct !== 'object' || !propertyStruct.productID) {
					 console.warn(`Skipping invalid property struct at index ${structIndex}:`, propertyStruct);
					return null;
				 }

				try {
					const images = Array.isArray(propertyStruct.images) ? propertyStruct.images : [];
					const location = Array.isArray(propertyStruct.location) ? propertyStruct.location : [];
					return {
						productID: propertyStruct.productID.toString(),
						productIdNumber: Number(propertyStruct.productID),
						owner: propertyStruct.owner,
						price: ethers.utils.formatEther(propertyStruct.price),
						propertyTitle: propertyStruct.propertyTitle || "Untitled Property",
						category: propertyStruct.category || "Uncategorized",
						images: images,
						location: location,
						description: propertyStruct.description || "No description.",
						nftId: propertyStruct.nftId || "N/A",
						isListed: propertyStruct.isListed,
						image: images.length > 0 ? images[0] : DEFAULT_PLACEHOLDER_IMAGE_URL,
                        displayLocation: location.length >= 3 ? `${location[2]}, ${location[1]}` : location.join(', '),
					};
				} catch (mapError) {
					 console.error(`Error processing property struct at index ${structIndex}:`, propertyStruct, mapError);
					 return null;
				}
			})
            .filter(p => p !== null);

        console.log(`Successfully processed ${processedProperties.length} properties.`);

		// 2. Filter for Listed Properties
		const listedProperties = processedProperties.filter(p => p.isListed);
        console.log(`Found ${listedProperties.length} listed properties.`);

		// 3. Sort by Product ID (Descending - Newest First)
		listedProperties.sort((a, b) => b.productIdNumber - a.productIdNumber);
        console.log("Sorted listed properties by ID (desc).");

		// 4. Slice to get only the latest properties
		const latestProperties = listedProperties.slice(0, LATEST_PROPERTIES_COUNT);
        console.log(`Sliced to get the latest ${latestProperties.length} properties.`);

		return latestProperties;

	} catch (error) {
		console.error("Error fetching/processing properties:", error);
		if (error.code === 'CALL_EXCEPTION') {
			 setErrorMsg("Error fetching properties. Please check network and contract status.");
		} else {
			 setErrorMsg(`An error occurred while fetching properties: ${error.message}`);
		}
		return [];
	}
}

function Home() {
	const [properties, setProperties] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMsgState, setErrorMsgState] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [filteredProperties, setFilteredProperties] = useState([]);

	useEffect(() => {
		setErrorMsg = setErrorMsgState;
		return () => { setErrorMsg = () => {}; };
	}, []);


	const loadProperties = useCallback(async () => {
		setIsLoading(true);
		setErrorMsgState("");
		setProperties([]);
		setFilteredProperties([]);
		console.log("Calling loadProperties (fetching latest)...");

		try {
			const latestFetchedProperties = await fetchProperties();
			setProperties(latestFetchedProperties);
			setFilteredProperties(latestFetchedProperties);
			console.log(`Loaded ${latestFetchedProperties.length} latest properties into state.`);
			if (latestFetchedProperties.length === 0 && !errorMsgState) {
				 console.log("Fetch successful, but no listed properties returned or found.");
			}
		} catch (error) {
			 console.error("Error caught in loadProperties:", error);
             if (!errorMsgState) {
                 setErrorMsgState(`Failed to load properties: ${error.message}`);
             }
			setProperties([]);
			setFilteredProperties([]);
		} finally {
			setIsLoading(false);
		}
	// Removed errorMsgState dependency as it could cause infinite loops if error happens
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		loadProperties();
	}, [loadProperties]);

	useEffect(() => {
		if (!searchTerm) {
			setFilteredProperties(properties);
			return;
		}
		const results = properties.filter((property) => {
			const searchableText = `
				${property.propertyTitle} ${property.category} ${property.price} ${property.description} ${property.displayLocation} ${property.location ? property.location.join(' ') : ''}
			`.toLowerCase();
			return searchableText.includes(searchTerm.toLowerCase());
		});
		setFilteredProperties(results);
	}, [searchTerm, properties]);

	const handleSearchChange = (event) => {
		setSearchTerm(event.target.value);
	};

	// --- Render Logic ---
	return (
        // Enhanced background gradient with pink and violet tones
		<div className="min-h-screen bg-gradient-to-br from-pink-50 via-violet-100 to-purple-200 text-gray-800 pb-16"> {/* Increased bottom padding */}
			 {/* Banner Section with enhanced background */}
			 <div className="flex justify-center items-center w-full h-[45vh] md:h-[55vh] px-4 py-6 bg-gradient-to-r from-violet-300 to-purple-400 shadow-lg relative overflow-hidden">
                 {/* Optional: Subtle pattern overlay */}
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-700/30 via-transparent to-transparent opacity-50"></div>
				 <img
					 src={banner}
					 className="w-full sm:w-11/12 md:w-4/5 lg:w-3/4 max-h-full object-contain rounded-lg shadow-2xl z-10" // Increased shadow
					 alt="Novaland Banner - Decentralized Real Estate"
				 />
			 </div>

			 {/* Search Bar - Enhanced styling */}
			 <div className="p-4 max-w-2xl mx-auto -mt-10 relative z-20"> {/* Adjusted max-width */}
				  <div className="relative">
					  <input
						  type="text"
						  placeholder="Search Latest Properties..."
                          // Enhanced input styling with pink/violet focus ring
						  className="w-full p-4 pl-12 pr-4 rounded-full shadow-xl bg-white border-2 border-transparent focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-300 transition duration-300 text-sm placeholder-gray-500"
						  value={searchTerm}
						  onChange={handleSearchChange}
					  />
					  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          {/* Changed icon color */}
						  <Search className="text-violet-400" size={20}/>
					  </div>
				  </div>
			 </div>

			{/* Properties Section */}
            <div className="p-6 max-w-7xl mx-auto mt-8"> {/* Increased margin top */}
                {/* Section Title - Enhanced styling */}
                <h1 className="font-extrabold text-3xl md:text-4xl text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-violet-600 to-purple-700 mb-10 tracking-tight">
                    Discover Latest Properties
                </h1>

                {/* Loading State - Enhanced */}
                {isLoading && (
                    <div className="text-center text-violet-600 font-semibold text-xl mt-12 flex items-center justify-center space-x-3">
                        <Loader className="animate-spin" size={24}/>
                        <span>Loading Properties...</span>
                    </div>
                )}

                {/* Error State - Enhanced */}
                {!isLoading && errorMsgState && (
                    <div className="text-center text-red-700 bg-red-100/70 backdrop-blur-sm p-5 rounded-lg font-semibold max-w-2xl mx-auto border border-red-200 flex flex-col items-center space-y-3">
                         <AlertCircle className="w-6 h-6 text-red-600"/>
                        <p>Error: {errorMsgState}</p>
                        <button
                            onClick={loadProperties}
                            className="mt-2 px-5 py-1.5 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-full text-sm hover:from-pink-600 hover:to-red-600 shadow hover:shadow-md transition-all duration-300"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                 {/* Properties Display */}
                 {!isLoading && !errorMsgState && (
                    <>
                        {/* No Results Message - Enhanced */}
                        {filteredProperties.length === 0 && (
                             <div className="text-center text-violet-700/80 mt-12 p-6 bg-violet-50 rounded-lg max-w-md mx-auto shadow-sm">
                                 {searchTerm
                                     ? `No properties found matching "${searchTerm}". Try adjusting your search.`
                                     : "No properties seem to be listed at the moment. Check back soon!"
                                 }
                             </div>
                        )}

                        {/* Property Grid - Enhanced Cards */}
                        {filteredProperties.length > 0 && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mt-6"> {/* Increased gap */}
                                {filteredProperties.map((property) => (
                                    // Property Card - Enhanced styling
                                    <div
                                        key={property.productID}
                                        // Added subtle gradient border on hover
                                        className="bg-white rounded-2xl shadow-lg hover:shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 border border-violet-100 flex flex-col group relative ring-1 ring-transparent hover:ring-pink-300/50"
                                    >
                                        {/* Link wraps image and text */}
                                        <Link
                                             to={`/property/${property.productID}`}
                                             className="block flex flex-col h-full" // Make link fill card height
                                         >
                                            {/* Image container */}
                                            <div className="relative h-52 w-full overflow-hidden"> {/* Increased height */}
                                                <img
                                                    src={property.image}
                                                    alt={property.propertyTitle || 'Property Image'}
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" // Slightly less zoom
                                                    onError={(e) => { e.target.onerror = null; e.target.src=DEFAULT_PLACEHOLDER_IMAGE_URL }}
                                                />
                                                {/* Category Badge - Pink/Violet themed */}
                                                <span className="absolute top-3 right-3 bg-gradient-to-tr from-pink-500 to-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                                                    {property.category}
                                                </span>
                                            </div>

                                            {/* Card Content */}
                                            <div className="p-5 flex flex-col flex-grow"> {/* Increased padding */}
                                                <h2
                                                    // Enhanced title style with gradient hover
                                                    className="text-lg font-bold text-violet-800 mb-1 truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-pink-600 group-hover:to-violet-600 transition-colors duration-300"
                                                    title={property.propertyTitle}
                                                >
                                                    {property.propertyTitle}
                                                </h2>
                                                 {/* Location - Enhanced styling */}
                                                 {property.displayLocation && property.displayLocation !== 'N/A' && (
                                                     <p className="text-xs text-violet-600/90 mb-3 truncate flex items-center" title={property.displayLocation}>
                                                          <MapPin className="h-3.5 w-3.5 mr-1 text-pink-400 flex-shrink-0" />
                                                          {property.displayLocation}
                                                     </p>
                                                 )}
                                                 {/* Price (Pushed to bottom) - Enhanced styling */}
                                                <p className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-500 mt-auto pt-2">
                                                    {property.price} ETH
                                                </p>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Optional: "View All" Button - Themed */}
                        {/* {properties.length === LATEST_PROPERTIES_COUNT && totalPropertyCount > LATEST_PROPERTIES_COUNT && (
                             <div className="text-center mt-12">
                                 <Link
                                     to="/explore"
                                     className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-md text-white bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-all duration-300 hover:shadow-lg"
                                 >
                                     View All Properties <ExternalLink className="ml-2 h-5 w-5" />
                                 </Link>
                             </div>
                        )} */}
                    </>
                )}
            </div>
		</div>
	);
}

export default Home;