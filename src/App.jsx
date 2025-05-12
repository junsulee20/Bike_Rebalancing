import React, { useState, useEffect } from 'react';
import './index.css';
export default function BikeRebalancingPlatform() {
  const [userLocation, setUserLocation] = useState('');
  const [bikeStations, setBikeStations] = useState([]);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sourceStation, setSourceStation] = useState(null);
  const [destinationStation, setDestinationStation] = useState(null);

  // API 설정값
  // const API_KEY
  // const API_BASE_URL
  
  // CORS 이슈를 해결하기 위한 프록시 설정 (필요시 사용)
  const useProxy = true;
  const PROXY_URL = 'https://thingproxy.freeboard.io/fetch/';

  // 따릉이 API에서 데이터 가져오기
  const fetchBikeStations = async () => {
    setLoading(true);
    setError(null);
    try {
      // API 요청 URL 구성
      let apiUrl = `http://openapi.seoul.go.kr:8088/494f6548506a756e38304273494961/json/bikeList/1/1000/`;

      // CORS 이슈가 있을 경우 프록시 사용
      if (useProxy) {
        apiUrl = PROXY_URL + apiUrl;
      }

      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error('따릉이 API 요청 실패');
      }

      const data = await response.json();

      // API 응답 구조 확인
      if (data.rentBikeStatus && data.rentBikeStatus.RESULT.CODE === 'INFO-000') {
        if (data.rentBikeStatus.row) {
          setBikeStations(data.rentBikeStatus.row);
        } else {
          throw new Error('API 응답에 대여소 데이터가 없습니다.');
        }
      } else {
        throw new Error('API 응답 오류: ' + data.rentBikeStatus.RESULT.MESSAGE);
      }
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다: ' + err.message);
      console.error('API 요청 에러:', err);

      // 개발용 예시 데이터로 대체
      setBikeStations([
        {"rackTotCnt":"15", "stationName":"102. 망원역 1번출구 앞", "parkingBikeTotCnt":"53", "shared":"353", "stationLatitude":"37.55564880", "stationLongitude":"126.91062927", "stationId":"ST-4"},
        {"rackTotCnt":"14", "stationName":"103. 망원역 2번출구 앞", "parkingBikeTotCnt":"27", "shared":"193", "stationLatitude":"37.55495071", "stationLongitude":"126.91083527", "stationId":"ST-5"},
        {"rackTotCnt":"13", "stationName":"104. 합정역 1번출구 앞", "parkingBikeTotCnt":"6", "shared":"46", "stationLatitude":"37.55073929", "stationLongitude":"126.91508484", "stationId":"ST-6"},
        {"rackTotCnt":"5", "stationName":"105. 합정역 5번출구 앞", "parkingBikeTotCnt":"6", "shared":"120", "stationLatitude":"37.55000687", "stationLongitude":"126.91482544", "stationId":"ST-7"},
        {"rackTotCnt":"12", "stationName":"106. 합정역 7번출구 앞", "parkingBikeTotCnt":"10", "shared":"83", "stationLatitude":"37.54864502", "stationLongitude":"126.91282654", "stationId":"ST-8"}
      ]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchBikeStations();
  }, []);

  // 하버사인 공식을 사용한 두 좌표 간의 거리 계산
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // 지구 반경 (km)
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d;
  };

  // 도(degree)를 라디안(radian)으로 변환
  const toRad = (value) => {
    return value * Math.PI / 180;
  };

  // 십진법 좌표를 DMS 형식으로 변환
  const convertToDMS = (coord, isLatitude) => {
    const absolute = Math.abs(coord);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
    
    const direction = isLatitude
      ? (coord >= 0 ? "N" : "S")
      : (coord >= 0 ? "E" : "W");
      
    return `${degrees}%C2%B0${minutes}'${seconds}"${direction}`;
  };

  // Google Maps URL 생성
  const createGoogleMapsUrl = (latitude, longitude) => {
    const latDMS = convertToDMS(parseFloat(latitude), true);
    const lonDMS = convertToDMS(parseFloat(longitude), false);
    return `https://www.google.com/maps/place/${latDMS}+${lonDMS}`;
  };

  // 현재 위치 기준 가까운 대여소 찾기
  const findNearbyStations = (userLat, userLon) => {
    if (!bikeStations.length) return [];
    
    return [...bikeStations]
      .map(station => ({
        ...station,
        sharedValue: parseInt(station.shared),
        distanceFromUser: calculateDistance(
          userLat, 
          userLon, 
          parseFloat(station.stationLatitude), 
          parseFloat(station.stationLongitude)
        )
      }))
      .sort((a, b) => a.distanceFromUser - b.distanceFromUser)
      .slice(0, 10); // 가장 가까운 10개 대여소만 반환
  };

  // 사용자 위치 기반 리밸런싱 계산
  const calculateRebalancing = () => {
    if (!userLocation || bikeStations.length === 0) return;
    
    try {
      const [userLat, userLon] = userLocation.split(',').map(coord => parseFloat(coord.trim()));
      
      if (isNaN(userLat) || isNaN(userLon)) {
        setError('올바른 위도,경도 형식으로 입력해주세요 (예: 37.55564880,126.91062927)');
        return;
      }
      
      // 대여소를 거치율에 따라 정렬
      const sortedStations = [...bikeStations]
        .map(station => ({
          ...station,
          sharedValue: parseInt(station.shared),
          distanceFromUser: calculateDistance(
            userLat, 
            userLon, 
            parseFloat(station.stationLatitude), 
            parseFloat(station.stationLongitude)
          )
        }))
        .sort((a, b) => a.distanceFromUser - b.distanceFromUser);
      
      // 가장 가까운 10개 대여소 설정
      setNearbyStations(sortedStations.slice(0, 10));
      
      // 높은 거치율을 가진 대여소 찾기 (값이 100을 초과하는 대여소)
      const highSharedStations = sortedStations.filter(station => station.sharedValue > 100);
      
      // 낮은 거치율을 가진 대여소 찾기 (값이 100 미만인 대여소)
      const lowSharedStations = sortedStations.filter(station => station.sharedValue < 100);
      
      if (highSharedStations.length === 0) {
        setError('리밸런싱이 필요한 높은 거치율의 대여소가 없습니다.');
        return;
      }
      
      if (lowSharedStations.length === 0) {
        setError('리밸런싱이 가능한 낮은 거치율의 대여소가 없습니다.');
        return;
      }
      
      // 사용자와 가장 가까운 높은 거치율 대여소
      const closestHighSharedStation = highSharedStations[0];
      
      // 선택된 출발 대여소에서 가장 가까운 낮은 거치율 대여소 찾기
      let closestLowSharedStation = null;
      let minDistance = Infinity;
      
      for (const lowStation of lowSharedStations) {
        const distance = calculateDistance(
          parseFloat(closestHighSharedStation.stationLatitude),
          parseFloat(closestHighSharedStation.stationLongitude),
          parseFloat(lowStation.stationLatitude),
          parseFloat(lowStation.stationLongitude)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestLowSharedStation = lowStation;
        }
      }
      
      setSourceStation(closestHighSharedStation);
      setDestinationStation(closestLowSharedStation);
      setError(null);
      
    } catch (err) {
      setError('계산 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 자동 위치 가져오기
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation(`${latitude},${longitude}`);
        },
        (error) => {
          setError('현재 위치를 가져오는데 실패했습니다: ' + error.message);
        }
      );
    } else {
      setError('브라우저가 위치 정보를 지원하지 않습니다.');
    }
  };

  const handleRefresh = () => {
    fetchBikeStations();
    setNearbyStations([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    calculateRebalancing();
  };

  return (
    <div className="flex justify-center w-screen min-h-screen bg-gray-50">
      <div className="w-full max-w-4xl">
        <br></br><h1 className="text-3xl font-bold text-center mb-8 text-green-700">따릉이 리밸런싱 플랫폼</h1>
        
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-700">대여소 데이터</h2>
            <button
              onClick={handleRefresh}
              className="p-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              데이터 새로고침
            </button>
          </div>
  
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-grow">
                <label htmlFor="userLocation" className="block text-gray-700 font-medium mb-2">
                  현재 위치 (위도,경도)
                </label>
                <input
                  type="text"
                  id="userLocation"
                  value={userLocation}
                  onChange={(e) => setUserLocation(e.target.value)}
                  placeholder="예: 37.55564880,126.91062927"
                  className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="p-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  현재 위치 불러오기
                </button>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="p-3 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  리밸런싱 계산
                </button>
              </div>
            </div>
          </form>
  
          {loading && (
            <div className="text-center p-4">
              <p className="text-gray-600">데이터를 불러오는 중...</p>
            </div>
          )}
  
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
              <p>{error}</p>
            </div>
          )}
  
          {sourceStation && destinationStation && (
            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4 text-blue-800">리밸런싱 추천</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 text-blue-700">출발 대여소 (높은 거치율)</h3>
                <div className="bg-white p-4 rounded shadow-sm">
                  <p className="font-medium">{sourceStation.stationName}</p>
                  <p className="text-gray-600 mb-2">
                    거치율: {sourceStation.shared}% (자전거 {sourceStation.parkingBikeTotCnt}대 / 거치대 {sourceStation.rackTotCnt}개)
                  </p>
                  <p className="text-gray-600 mb-4">위치: {sourceStation.stationLatitude}, {sourceStation.stationLongitude}</p>
                  <a 
                    href={createGoogleMapsUrl(sourceStation.stationLatitude, sourceStation.stationLongitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    구글 지도에서 보기
                  </a>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2 text-blue-700">도착 대여소 (낮은 거치율)</h3>
                <div className="bg-white p-4 rounded shadow-sm">
                  <p className="font-medium">{destinationStation.stationName}</p>
                  <p className="text-gray-600 mb-2">
                    거치율: {destinationStation.shared}% (자전거 {destinationStation.parkingBikeTotCnt}대 / 거치대 {destinationStation.rackTotCnt}개)
                  </p>
                  <p className="text-gray-600 mb-4">위치: {destinationStation.stationLatitude}, {destinationStation.stationLongitude}</p>
                  <a 
                    href={createGoogleMapsUrl(destinationStation.stationLatitude, destinationStation.stationLongitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    구글 지도에서 보기
                  </a>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-gray-700">
                  이동 거리: 약 {calculateDistance(
                    parseFloat(sourceStation.stationLatitude),
                    parseFloat(sourceStation.stationLongitude),
                    parseFloat(destinationStation.stationLatitude),
                    parseFloat(destinationStation.stationLongitude)
                  ).toFixed(2)} km
                </p>
              </div>
            </div>
          )}
          
          {/* 근처 대여소 리스트 - 새로 추가된 부분 */}
          {nearbyStations.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">현재 위치 주변 대여소 (가까운 순)</h3>
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">대여소명</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">거리</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">거치율</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">자전거 / 거치대</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {nearbyStations.map((station, index) => (
                      <tr key={index} className={parseFloat(station.shared) > 100 ? "bg-green-50" : parseFloat(station.shared) < 50 ? "bg-red-50" : ""}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{station.stationName}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{station.distanceFromUser.toFixed(2)} km</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{station.shared}%</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{station.parkingBikeTotCnt} / {station.rackTotCnt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">로드된 대여소 정보</h3>
          <div className="bg-white shadow-sm rounded p-4 overflow-auto max-h-60">
            <p className="mb-2">총 {bikeStations.length}개의 대여소 데이터 로드됨</p>
            {bikeStations.length > 0 && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">대여소명</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">거치율</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">자전거 / 거치대</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bikeStations.slice(0, 5).map((station, index) => (
                    <tr key={index} className={parseFloat(station.shared) > 100 ? "bg-green-50" : parseFloat(station.shared) < 50 ? "bg-red-50" : ""}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{station.stationName}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{station.shared}%</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{station.parkingBikeTotCnt} / {station.rackTotCnt}</td>
                    </tr>
                  ))}
                  {bikeStations.length > 5 && (
                    <tr>
                      <td colSpan="3" className="px-3 py-2 text-sm text-gray-500 text-center">... 외 {bikeStations.length - 5}개 더 있음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        <div className="bg-gray-100 p-4 rounded text-sm text-gray-600 mt-6">
          <p>※ 리밸런싱: 거치율이 100% 이상인 대여소의 자전거를 100% 미만인 대여소로 이동시키는 과정</p>
          <p>※ 추후, 노인 일자리 개념의 따릉이 리밸런싱을 통해 노인층에게 리워드를 지급하고, 청년들의 따릉이 이용률을 증가시킬 계획입니다.
          </p>
          <p className="mt-2 text-xs">API 제공: 서울특별시</p>
          <p className="mt-2 text-xs">제작: NEXT 13기 학회원 이준수</p>
        </div>
      </div>
    </div>
  );
  
}
