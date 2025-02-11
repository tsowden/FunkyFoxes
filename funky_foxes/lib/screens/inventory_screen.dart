// lib/screens/inventory_screen.dart
import 'package:flutter/material.dart';
import '../services/game_service.dart';
import '../styles/app_theme.dart';

class InventoryScreen extends StatefulWidget {
  final String gameId;
  final String playerId;
  final GameService gameService;

  const InventoryScreen({
    Key? key,
    required this.gameId,
    required this.playerId,
    required this.gameService,
  }) : super(key: key);

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  @override
  void initState() {
    super.initState();
    print("InventoryScreen: Initialized for game ${widget.gameId}");
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      // appBar: AppBar(
      //   title: const Text('Inventory'),
      //   backgroundColor: AppTheme.greenButton,
      //   iconTheme: const IconThemeData(color: Colors.transparent),
      // ),
      child: Container(
        decoration: AppTheme.backgroundDecoration(),
        child: ListView.builder(
          itemCount: 10,
          itemBuilder: (context, index) {
            return Card(
              margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              elevation: 4,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: ListTile(
                leading: const Icon(Icons.collections, color: AppTheme.greenButton),
                title: Text(
                  'Item ${index + 1}',
                  style: AppTheme.themeData.textTheme.bodyMedium,
                ),
                trailing: const Icon(Icons.arrow_forward_ios, color: AppTheme.greenButton),
                onTap: () {
                  // Action lors du tap sur un item
                },
              ),
            );
          },
        ),
      ),
      // Pas de BottomNavigationBar ici (gérée par GameHomeScreen)
    );
  }
}
