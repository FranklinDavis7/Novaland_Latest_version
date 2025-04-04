import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { ethers } from "ethers";
import { supabase } from "../../supabase";
import {
	FiMapPin,
	FiTag,
	FiCheckCircle,
	FiXCircle,
	FiLoader,
	FiExternalLink,
	FiInfo,
	FiShoppingCart,
	FiMessageSquare,
	FiAlertTriangle,
} from "react-icons/fi";
import { FaMapMarkedAlt } from "react-icons/fa";

import contractABI from "./../../contractABI2.json";
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424";

// !!!!! WARNING: HARDCODED API KEY - INSECURE - FOR TEMPORARY TESTING ONLY !!!!!
const GOOGLE_MAPS_API_KEY = "AIzaSyB8SAwnU9wwz25E8MPlDWSV1ITVAgNQLV8";
// !!!!! END WARNING !!!!!

const DEFAULT_PLACEHOLDER_IMAGE_URL =
	"https://via.placeholder.com/600x400.png?text=Property+Image";

async function loadContract(signer = null) {
	if (!window.ethereum) {
		console.error("MetaMask not found.");
		return null;
	}
	try {
		const provider = new ethers.providers.Web3Provider(window.ethereum);
		const contractInstance = new ethers.Contract(
			contractAddress,
			contractABI,
			signer || provider
		);
		if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
			throw new Error("Update contract address.");
		}
		if (!ethers.utils.isAddress(contractAddress)) {
			throw new Error(`Invalid Address: ${contractAddress}`);
		}
		return contractInstance;
	} catch (error) {
		console.error("Error loading contract:", error);
		throw new Error(`Failed to load contract: ${error.message}`);
	}
}

function PropertyInfo() {
	const { id } = useParams();
	const navigate = useNavigate();
	const [property, setProperty] = useState(null);
	const [walletAddress, setWalletAddress] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isOfferPending, setIsOfferPending] = useState(false);
	const [isBuying, setIsBuying] = useState(false);
	const [buyError, setBuyError] = useState("");
	const [buySuccess, setBuySuccess] = useState("");

	const checkOfferStatus = useCallback(async (propertyId, currentWalletAddress) => {
		if (!currentWalletAddress || !propertyId) return;
		try {
			const normalizedWallet = currentWalletAddress.toLowerCase();
			const numericPropertyId = parseInt(propertyId, 10);
			if (isNaN(numericPropertyId)) return;
			const { data, error: dbError } = await supabase
				.from("threads")
				.select("status")
				.eq("property_id", numericPropertyId)
				.eq("buyer_wallet", normalizedWallet)
				.eq("status", "open")
				.limit(1);
			if (dbError) throw dbError;
			setIsOfferPending(data && data.length > 0);
		} catch (err) {
			console.error("Error checking offer status:", err.message);
		}
	}, []);

	useEffect(() => {
		const fetchPropertyAndCheckWallet = async () => {
			setLoading(true);
			setError(null);
			setProperty(null);
			setIsOfferPending(false);
			setBuyError("");
			setBuySuccess("");
			let currentWallet = null;
			if (window.ethereum) {
				try {
					const accounts = await window.ethereum.request({
						method: "eth_accounts",
					});
					if (accounts.length > 0) {
						currentWallet = accounts[0];
						setWalletAddress(currentWallet);
					}
				} catch (error) {
					console.error("Error checking wallet connection:", error);
				}
			} else {
				console.warn("MetaMask not detected.");
			}
			try {
				const contract = await loadContract();
				if (!contract) {
					throw new Error("Contract interaction unavailable.");
				}
				const allPropertiesData = await contract.FetchProperties();
				const propertyData = allPropertiesData.find(
					(p) => p?.productID?.toString() === id
				);
				if (!propertyData) {
					throw new Error(`Property with ID ${id} not found.`);
				}
				const location = Array.isArray(propertyData.location)
					? propertyData.location
					: [];
				const images = Array.isArray(propertyData.images)
					? propertyData.images
					: [];
				const documents = Array.isArray(propertyData.documents)
					? propertyData.documents
					: [];
				const parsedProperty = {
					productID: propertyData.productID.toString(),
					owner: propertyData.owner,
					price: ethers.utils.formatEther(propertyData.price),
					priceWei: propertyData.price,
					propertyTitle: propertyData.propertyTitle,
					category: propertyData.category,
					images:
						images.length > 0 ? images : [DEFAULT_PLACEHOLDER_IMAGE_URL],
					location: location,
					documents: documents,
					description: propertyData.description,
					nftId: propertyData.nftId || "N/A",
					isListed: propertyData.isListed,
					displayLocation:
						location.length >= 3
							? `${location[2]}, ${location[1]}`
							: location.length > 0
							? location.join(", ")
							: "Location not specified",
					stringAddress: location.length > 4 ? location[4] : "",
					gmapLink: location.length > 5 ? location[5] : "",
				};
				setProperty(parsedProperty);
				if (currentWallet) {
					await checkOfferStatus(parsedProperty.productID, currentWallet);
				}
			} catch (err) {
				console.error("Error fetching property details:", err);
				setError(err.message || "Failed fetch.");
			} finally {
				setLoading(false);
			}
		};
		fetchPropertyAndCheckWallet();
	}, [id, checkOfferStatus]);

	const connectWallet = async () => {
		if (window.ethereum) {
			try {
				const accounts = await window.ethereum.request({
					method: "eth_requestAccounts",
				});
				if (accounts.length > 0) {
					const newAddress = accounts[0];
					setWalletAddress(newAddress);
					if (property) {
						await checkOfferStatus(property.productID, newAddress);
					}
					setError(null);
					setBuyError("");
				}
			} catch (error) {
				console.error("Error connecting wallet:", error);
				if (error.code === 4001) {
					setError("Wallet connection rejected.");
				} else {
					setError("Failed to connect wallet.");
				}
			}
		} else {
			setError("MetaMask not detected.");
			alert("MetaMask not detected.");
		}
	};

	const handleBuyNow = async () => {
        // Pre-flight checks
        if (!walletAddress) {
            setBuyError("Please connect your wallet first.");
            return;
        }
        if (!property) {
            setBuyError("Property data not loaded. Please refresh.");
            return;
        }
        if (walletAddress.toLowerCase() === property.owner.toLowerCase()) {
            setBuyError("You cannot buy a property you already own.");
            return;
        }
        if (!property.isListed) {
            setBuyError("This property is not currently listed for sale.");
            return;
        }

        setIsBuying(true); // Set loading state for purchase
        setBuyError("");   // Clear previous errors
        setBuySuccess(""); // Clear previous success messages

        try {
            // Need signer to send transaction
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            if (!signer || !(await signer.getAddress())) { // Verify signer is available
                setBuyError("Wallet signer is unavailable. Ensure your wallet is unlocked and connected.");
                setIsBuying(false);
                return;
            }

            // Load contract instance with the signer
            const contractWithSigner = await loadContract(signer);
            if (!contractWithSigner) {
                // loadContract should throw, but double-check
                throw new Error("Failed to initialize contract for transaction.");
            }

            console.log(`Attempting purchase for property ID: ${property.productID}`);
            console.log(`Buyer Address: ${walletAddress}`);
            console.log(`Sending value (Wei): ${property.priceWei.toString()}`);

            // --- Call the updated PurchaseProperty function ---
            // Arguments: Property ID, Buyer Address
            // Value: Price in Wei
            const transaction = await contractWithSigner.PurchaseProperty(
                property.productID, // uint256 id
                walletAddress,     // address buyer
                {
                    value: property.priceWei, // payable amount
                    gasLimit: 300000 // Optional: Adjust gas limit if needed, estimateGas is safer
                }
            );

            setBuySuccess("Purchase transaction sent. Waiting for confirmation...");
            console.log("Transaction sent:", transaction.hash);

            // Wait for the transaction to be mined
            const receipt = await transaction.wait();
            console.log("Transaction confirmed:", receipt);

            // Check transaction status in receipt
            if (receipt.status === 0) {
                throw new Error("Transaction failed on the blockchain (reverted). Check Etherscan for details.");
            }

            setBuySuccess(`Purchase successful! Transaction Hash: ${receipt.transactionHash}`);
            setIsBuying(false); // Reset loading state

            // Optional: Redirect after a delay
            setTimeout(() => {
                navigate("/dashboard"); // Redirect to dashboard after success
            }, 4000); // 4 second delay

        } catch (purchaseError) {
            console.error("Purchase failed:", purchaseError);
            let message = "An error occurred during purchase.";

            // Attempt to parse specific error types
            if (purchaseError.code === "ACTION_REJECTED" || purchaseError.code === 4001) {
                message = "Transaction rejected in wallet.";
            } else if (purchaseError.reason) {
                // Ethers.js often includes a reason for reverted transactions
                message = `Transaction failed: ${purchaseError.reason}`;
            } else if (purchaseError.data?.message) {
                // Some errors might have data.message
                message = `Transaction failed: ${purchaseError.data.message}`;
            } else if (purchaseError.message) {
                // Fallback to general error message
                message = purchaseError.message;
            }

            // Customize messages based on common revert reasons (if identifiable)
            if (message.toLowerCase().includes("not listed for sale")) {
                message = "Property is no longer listed for sale.";
            } else if (message.toLowerCase().includes("insufficient funds")) {
                message = "Insufficient funds for transaction cost + gas.";
            } else if (message.toLowerCase().includes("buyer cannot be the current owner")) {
                 message = "Owner cannot buy their own property.";
            }

            setBuyError(message.substring(0, 200)); // Truncate long messages if needed
            setBuySuccess(""); // Clear any pending success message
            setIsBuying(false); // Reset loading state
        }
    };

	const sliderSettings = {
		dots: true,
		infinite: (property?.images?.length ?? 0) > 1,
		speed: 500,
		slidesToShow: 1,
		slidesToScroll: 1,
		autoplay: true,
		autoplaySpeed: 4000,
		fade: true,
		cssEase: "linear",
		adaptiveHeight: true,
	};

	if (loading)
		return (
			<div className="flex justify-center items-center min-h-screen text-xl font-semibold text-indigo-700">
				<FiLoader className="animate-spin mr-3" size={24} />
				Loading...
			</div>
		);
	if (error && !property)
		return (
			<div className="flex justify-center items-center min-h-screen text-xl font-semibold text-red-600 bg-red-50 p-10 rounded-md">
				<FiXCircle className="mr-3" size={24} />
				Error: {error}
			</div>
		);
	if (!property)
		return (
			<div className="flex justify-center items-center min-h-screen text-xl font-semibold text-gray-600">
				Property not found.
			</div>
		);

	const isOwner =
		walletAddress &&
		property.owner &&
		walletAddress.toLowerCase() === property.owner.toLowerCase();
	const isValidHttpUrl = (string) => {
		let url;
		try {
			url = new URL(string);
		} catch (_) {
			return false;
		}
		return url.protocol === "http:" || url.protocol === "https:";
	};
	const canShowGMapLink = property.gmapLink && isValidHttpUrl(property.gmapLink);

	let mapEmbedSrc = null;
	const mapQuery = [
		property.stringAddress,
		property.location?.[2],
		property.location?.[1],
		property.location?.[0],
	]
		.filter(Boolean)
		.join(", ");
	if (GOOGLE_MAPS_API_KEY && mapQuery) {
		mapEmbedSrc = `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(
			mapQuery
		)}`;
	}

	return (
		<div className="relative min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 text-gray-900 py-12">
			<div className="p-4 md:p-8 max-w-7xl mx-auto">
				<h1 className="text-3xl md:text-5xl font-bold text-center mb-6 text-gray-800">
					{property.propertyTitle}
				</h1>
				<p className="text-center text-gray-500 mb-8 text-sm">
					Property ID: {property.productID} | NFT ID: {property.nftId}
				</p>

				<div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
					{/* Left Side: Image Slider, Documents, Map Embed */}
					<div className="w-full lg:w-[55%] xl:w-3/5">
						{/* Image Slider */}
						<div className="mb-8 shadow-xl rounded-lg overflow-hidden border border-gray-200 bg-white">
							{property.images &&
							property.images.length > 0 &&
							property.images[0] !== DEFAULT_PLACEHOLDER_IMAGE_URL ? (
								<Slider {...sliderSettings}>
									{property.images.map((image, index) => (
										<div key={index}>
											<img
												src={image}
												alt={`Property ${index + 1}`}
												className="w-full h-80 md:h-[500px] object-cover"
												onError={(e) => {
													e.target.onerror = null;
													e.target.src = DEFAULT_PLACEHOLDER_IMAGE_URL;
												}}
											/>
										</div>
									))}
								</Slider>
							) : (
								<img
									src={DEFAULT_PLACEHOLDER_IMAGE_URL}
									alt="Placeholder"
									className="w-full h-80 md:h-[500px] object-cover"
								/>
							)}
						</div>

						{/* Documents Section */}
						{property.documents && property.documents.length > 0 && (
							<div className="mb-8 bg-white p-5 rounded-lg shadow-md border border-gray-200">
								<h3 className="text-xl font-semibold mb-4 text-gray-700">
									Attached Documents
								</h3>
								<ul className="space-y-3">
									{property.documents.map((docUrl, index) => (
										<li key={index} className="flex items-center">
											<FiExternalLink className="text-indigo-500 mr-2 flex-shrink-0" />{" "}
											<a
												href={docUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline break-all"
												title={`View Doc ${index + 1}`}
											>
												Document {index + 1}{" "}
												<span className="text-xs">(opens new tab)</span>
											</a>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Google Maps Embed Section */}
						<div className="bg-white p-5 rounded-lg shadow-md border border-gray-200">
							<h3 className="text-xl font-semibold mb-3 text-gray-700 flex items-center">
								<FaMapMarkedAlt className="mr-2 text-red-600" /> Map Location
							</h3>
							{/* Config Warning */}
							{(!GOOGLE_MAPS_API_KEY ||
								GOOGLE_MAPS_API_KEY === "AIzaSy...") &&
								mapQuery && (
									<p className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200 flex items-center">
										<FiAlertTriangle className="mr-1" />
										Maps API Key missing or invalid.
									</p>
								)}
							{/* Map Embed iframe */}
							{mapEmbedSrc && (
								<div className="mt-2 rounded-md overflow-hidden border border-gray-200 shadow-sm aspect-w-16 aspect-h-9">
									<iframe
										src={mapEmbedSrc}
										width="100%"
										height="400"
										style={{ border: 0 }}
										allowFullScreen={false}
										loading="lazy"
										referrerPolicy="no-referrer-when-downgrade"
										title={`Map for ${property.propertyTitle}`}
									></iframe>
								</div>
							)}
							{/* Info if map cannot be shown */}
							{!mapEmbedSrc && GOOGLE_MAPS_API_KEY && property && (
								<div className="text-gray-500 text-sm p-3 bg-gray-50 rounded border border-gray-200">
									Map could not be displayed. Ensure address details are complete.
								</div>
							)}
							{/* Show text link as fallback or additional info */}
							{canShowGMapLink && (
								<div className="mt-3 text-sm">
									<a
										href={property.gmapLink}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center"
										title="Open original link in Google Maps"
									>
										<FiExternalLink className="mr-1" /> View Original Map Link
									</a>
								</div>
							)}
						</div>
					</div>

					{/* Right Side: Details & Actions */}
					<div className="w-full lg:w-[45%] xl:w-2/5 bg-white p-6 md:p-8 rounded-lg shadow-xl border border-gray-200 flex flex-col">
						{/* Listing Status */}
						<div
							className={`mb-4 p-3 rounded-md text-center font-medium text-sm ${
								property.isListed
									? "bg-green-100 text-green-800 border border-green-200"
									: "bg-yellow-100 text-yellow-800 border border-yellow-200"
							}`}
						>
							{" "}
							{property.isListed ? (
								<>
									<FiCheckCircle className="inline mr-1 mb-0.5" /> Listed
								</>
							) : (
								<>
									<FiXCircle className="inline mr-1 mb-0.5" /> Not Listed
								</>
							)}{" "}
						</div>
						{/* Location & Category Section */}
						<div className="mb-6 border-b border-gray-200 pb-4">
							<h3 className="text-xl font-semibold mb-3 text-gray-700">
								Details
							</h3>
							<div className="flex items-start text-md text-gray-600 mb-3">
								<FiTag className="mr-3 mt-1 text-indigo-600 flex-shrink-0" size={18} />
								<div>
									<span className="font-medium text-gray-800 block">
										{property.category}
									</span>
									<span className="text-xs text-gray-500">Type</span>
								</div>
							</div>
							<div className="flex items-start text-md text-gray-600 mb-3">
								<FiMapPin
									className="mr-3 mt-1 text-indigo-600 flex-shrink-0"
									size={18}
								/>
								<div>
									<span className="font-medium text-gray-800 block">
										{property.displayLocation || "N/A"}
									</span>
									<span className="text-xs text-gray-500">Location</span>
								</div>
							</div>
							{property.stringAddress && (
								<div className="flex items-start text-md text-gray-600 mb-3">
									<FiMapPin
										className="mr-3 mt-1 text-indigo-600 flex-shrink-0 opacity-80"
										size={18}
									/>
									<div>
										<span className="font-medium text-gray-800 block">
											{property.stringAddress}
										</span>
										<span className="text-xs text-gray-500">Address</span>
									</div>
								</div>
							)}
							{canShowGMapLink && (
								<div className="flex items-start text-md text-gray-600 mb-1">
									<FaMapMarkedAlt
										className="mr-3 mt-1 text-blue-600 flex-shrink-0"
										size={18}
									/>
									<div>
										<a
											href={property.gmapLink}
											target="_blank"
											rel="noopener noreferrer"
											className="font-medium text-blue-600 hover:text-blue-800 hover:underline break-all"
											title="Open Google Maps"
										>
											<FiExternalLink className="inline ml-1 mb-0.5" size={12} />{" "}
											View Link
										</a>
										<span className="text-xs text-gray-500 block">Map Link</span>
									</div>
								</div>
							)}
						</div>
						{/* Price */}
						<div className="mb-6">
							<span className="text-gray-500 text-sm block mb-1">Price</span>
							<div className="text-4xl md:text-5xl font-bold text-indigo-700">
								{property.price} ETH
							</div>
						</div>
						{/* Description */}
						<div className="mb-6 flex-grow">
							<h3 className="text-xl font-semibold mb-2 text-gray-700">
								Description
							</h3>
							<p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
								{property.description || "No description."}
							</p>
						</div>
						{/* Owner Info */}
						<div className="mb-6 border-t pt-4 mt-4">
							<h3 className="text-lg font-semibold mb-2 text-gray-700">Owner</h3>
							<p
								className="text-gray-600 text-xs break-all"
								title={property.owner}
							>
								{property.owner}
							</p>
							{isOwner && (
								<span className="text-xs text-green-600 font-medium block mt-1">
									(This is you)
								</span>
							)}
						</div>
						{/* Action Buttons Area */}
						<div className="mt-auto pt-5 border-t border-gray-200 space-y-4">
							{buyError && (
								<p className="text-sm text-red-600 p-3 bg-red-50 border border-red-200 rounded text-center">
									<FiXCircle className="inline mr-1" /> {buyError}
								</p>
							)}
							{buySuccess && (
								<p className="text-sm text-green-600 p-3 bg-green-50 border border-green-200 rounded text-center">
									<FiCheckCircle className="inline mr-1" /> {buySuccess}
								</p>
							)}
							{isBuying && (
								<p className="text-sm text-blue-600 p-3 bg-blue-50 border border-blue-200 rounded text-center flex justify-center items-center">
									<FiLoader className="animate-spin mr-2" /> Processing...
								</p>
							)}
							{!walletAddress && (
								<button
									onClick={connectWallet}
									disabled={isBuying}
									className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50"
								>
									Connect Wallet
								</button>
							)}
							{walletAddress && !isBuying && !buySuccess && (
								<div className="space-y-3">
									{property.isListed && !isOwner && (
										<button
											onClick={handleBuyNow}
											className="w-full flex justify-center items-center px-6 py-3 bg-green-600 text-white rounded-lg text-base font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition shadow-md"
										>
											<FiShoppingCart className="mr-2" /> Buy Now ({property.price}{" "}
											ETH)
										</button>
									)}
									{!isOwner && (
										<Link
											to="/make-offer"
											state={{
												buyerWallet: walletAddress,
												sellerWallet: property.owner,
												propertyId: property.productID,
												propertyTitle: property.propertyTitle,
												propertyPrice: property.price,
												propertyImage:
													property.images[0] ?? DEFAULT_PLACEHOLDER_IMAGE_URL,
											}}
											className={`w-full inline-flex justify-center items-center text-center px-6 py-3 rounded-lg text-base font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 border ${
												isOfferPending
													? "bg-yellow-100 text-yellow-800 border-yellow-300 cursor-not-allowed"
													: !property.isListed
													? "bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed"
													: "bg-indigo-600 text-white border-transparent hover:bg-indigo-700 focus:ring-indigo-500 shadow-md"
											}`}
											onClick={(e) => {
												if (isOfferPending || !property.isListed) {
													e.preventDefault();
													if (isOfferPending) alert("Offer pending.");
													if (!property.isListed) alert("Cannot offer.");
												}
											}}
											aria-disabled={isOfferPending || !property.isListed}
										>
											<FiMessageSquare className="mr-2" />{" "}
											{isOfferPending
												? "Offer Pending"
												: property.isListed
												? "Make Offer/Contact"
												: "Make Offer (Not Listed)"}
										</Link>
									)}
									{isOwner && (
										<Link
											to={`/update-property/${property.productID}`}
											className="w-full inline-block text-center px-6 py-3 bg-purple-600 text-white rounded-lg text-base font-medium hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition shadow-md"
										>
											Edit Property
										</Link>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default PropertyInfo;