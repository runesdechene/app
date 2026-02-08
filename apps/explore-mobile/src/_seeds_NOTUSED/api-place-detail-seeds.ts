import { ApiPlaceDetail } from '@model'

export const apiPlaceDetailSeeds: ApiPlaceDetail[] = [
  {
    id: '1',
    title: 'Machtou Pichtou',
    author: {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      profileImageUrl: null,
    },
    images: [
      {
        id: '1',
        url: 'https://media.cntraveler.com/photos/5eb18e42fc043ed5d9779733/16:9/w_4288,h_2412,c_limit/BlackForest-Germany-GettyImages-147180370.jpg',
      },
      {
        id: '2',
        url: 'https://firebasestorage.googleapis.com/v0/b/wanderers-9e30d.appspot.com/o/public%2Fusers%2FZSxtsQCAZcOPyxcHCSCxAKpTe8E2%2Fplaces%2FNQ8FCYLO-%2Fiw-wOP46ZG?alt=media&token=cac2bf34-bac5-486d-a1a4-c6fc8bbe2039',
      },
      {
        id: '3',
        url: 'https://firebasestorage.googleapis.com/v0/b/wanderers-9e30d.appspot.com/o/public%2Fusers%2FjK2b2UwZ6wQXtbd7RzaQN9CeSXh2%2Fplaces%2Fa_kjdpx7-%2FGTeP6YbzG?alt=media&token=4eda9619-8cc7-4e80-8e46-d663c884cfef',
      },
    ],
    type: {
      id: '1',
      imageUrl:
        'https://firebasestorage.googleapis.com/v0/b/wanderers-9e30d.appspot.com/o/public%2Fapp%2FplaceTypes%2FqFgH3VtCz%2Fpymsz5N94C?alt=media&token=baece7b5-2992-47ce-9b37-92927cd63191',
      mapImageUrl:
        'https://firebasestorage.googleapis.com/v0/b/wanderers-9e30d.appspot.com/o/public%2Fapp%2FplaceTypes%2F_cjvj91BX%2FxJ5eQFAZl.png?alt=media',
      title: 'Restaurant',
      color: '#b97460',
    },
    location: {
      latitude: 46.93279124,
      longitude: 4.04846882,
    },
    requester: {
      bookmarked: false,
      liked: false,
      explored: false,
    },
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse ac elit quis mi accumsan fringilla. Sed sollicitudin tellus eu magna imperdiet, sodales semper odio gravida. Curabitur pharetra, velit non pretium laoreet, dui odio auctor dui, eget mollis lectus libero ac erat. In ut volutpat lectus. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer eget euismod libero, non aliquet libero. Etiam in quam varius, commodo libero sit amet, euismod nibh. Nulla posuere mi luctus, condimentum erat non, pellentesque dolor. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec mattis orci nec pretium feugiat. Quisque blandit mauris elit, eu convallis felis laoreet eget. Morbi at viverra nulla. Integer felis justo, bibendum non maximus vel, rhoncus vel lacus. Ut aliquet nisl eu magna sodales, quis blandit arcu convallis.',
    address: 'Paris',
    metrics: {
      views: 0,
      likes: 0,
      explored: 0,
    },
  },
]
