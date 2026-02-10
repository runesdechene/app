export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const toRadian = (n: number) => (n * Math.PI) / 180
  let R = 6371 // km
  let x1 = lat2 - lat1
  let dLat = toRadian(x1)
  let x2 = lon2 - lon1
  let dLon = toRadian(x2)
  let a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadian(lat1)) *
      Math.cos(toRadian(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  let d = R * c
  return d
}
