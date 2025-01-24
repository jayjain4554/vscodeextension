#include <bits/stdc++.h>
using namespace std;

#define ll long long


vector<int> findOriginalArray(vector<int>& changed) {
    int n = changed.size();
    if (n % 2 == 1) return {};
    sort(changed.begin(), changed.end());
    vector<int> ans;
    
    map<int, int> mp;

    for (int i = 0; i < n; i++) {
        mp[changed[i]]++;
    }
    for (int i = 0; i < n; i++) {
        if (mp[changed[i]] == 0) continue;
        if (mp[changed[i] * 2] == 0) return {};
        ans.push_back(changed[i]);
        mp[changed[i]]--;
        mp[changed[i] * 2]--;
    }
    return ans;
}



int main(){
    
    int t = 1 ;  

    // cin>>t; 
    while(t--){
        // int ans = 0;

        int n;
        cin>>n;
        vector <int > v ;
        for ( int i = 0; i < n ; i++)
        {
            ll a;
            cin >> a ;
            v.push_back( a ) ;
        }


        vector < int > temp = findOriginalArray( v ) ;
        for ( int i = 0 ; i < temp.size() ; i++)
        {
            cout << temp [ i ] << " " ;
        }

        cout << endl ;

    }
}