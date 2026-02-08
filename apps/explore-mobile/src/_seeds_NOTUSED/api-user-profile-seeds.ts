import { ApiUserProfile } from '@model'

export const apiUserProfileSeeds: ApiUserProfile[] = [
  {
    id: '1',
    firstName: 'Anthony',
    lastName: 'Cyrille',
    biography:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse ac elit quis mi accumsan fringilla. Sed sollicitudin tellus eu magna imperdiet, sodales semper odio gravida. Curabitur pharetra, velit non pretium laoreet, dui odio auctor dui, eget mollis lectus libero ac erat. In ut volutpat lectus. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer eget euismod libero, non aliquet libero. Etiam in quam varius, commodo libero sit amet, euismod nibh. Nulla posuere mi luctus, condimentum erat non, pellentesque dolor. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec mattis orci nec pretium feugiat. Quisque blandit mauris elit, eu convallis felis laoreet eget. Morbi at viverra nulla. Integer felis justo, bibendum non maximus vel, rhoncus vel lacus. Ut aliquet nisl eu magna sodales, quis blandit arcu convallis.',
    profileImageUrl:
      'https://firebasestorage.googleapis.com/v0/b/wanderers-9e30d.appspot.com/o/public%2Fusers%2FH9PmBKnGb0Ojfr926CFtbvPrwct2%2FfPIJk3GUa.xMY0Nuy59?alt=media',
    metrics: {
      placesAdded: 10,
      placesExplored: 5,
    },
  },
]
