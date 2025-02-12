// lib/screens/inventory_screen.dart

import 'dart:convert';
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
  List<Map<String, dynamic>> _myInventory = [];

  @override
  void initState() {
    super.initState();
    print("InventoryScreen: Initialized for game ${widget.gameId}");

    // Écoute des infos de la partie pour mettre à jour l'inventaire
    widget.gameService.onGameInfos((data) {
      if (!mounted) return;
      final playersData = data['players'] ?? [];
      if (playersData is List) {
        final me = playersData.firstWhere(
          (p) => p['playerId'] == widget.playerId,
          orElse: () => null,
        );
        if (me != null && me is Map) {
          final newInventory = me['inventory'] ?? [];
          setState(() {
            _myInventory = List<Map<String, dynamic>>.from(newInventory);
          });
        }
      }
    });

    // Demande explicite d'actualisation dès l'ouverture
    widget.gameService.socket.emit('requestGameInfos', {
      'gameId': widget.gameId,
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        decoration: AppTheme.backgroundDecoration(),
        child: _buildInventoryContent(),
      ),
    );
  }

  Widget _buildInventoryContent() {
    if (_myInventory.isEmpty) {
      return Center(
        child: Text(
          "Your inventory is empty",
          style: AppTheme.themeData.textTheme.bodyLarge,
        ),
      );
    }

    return ListView.builder(
      itemCount: _myInventory.length,
      itemBuilder: (context, index) {
        final item = _myInventory[index];
        return _buildInventoryItem(item);
      },
    );
  }

  Widget _buildInventoryItem(Map<String, dynamic> item) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: _buildItemLeading(item),
        title: Text(
          item['name'] ?? 'Unknown item',
          style: AppTheme.themeData.textTheme.bodyMedium,
        ),
        // subtitle: Text(
        //   item['description'] ?? '',
        //   style: AppTheme.themeData.textTheme.bodySmall,
        // ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Bouton "Utiliser"
            IconButton(
              icon: const Icon(Icons.build_circle, color: AppTheme.greenButton),
              tooltip: 'Use item',
              onPressed: () {
                // Montre juste un SnackBar
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text("Using ${item['name']}... (not implemented)"),
                  ),
                );
              },
            ),
            // Bouton "Jeter"
            IconButton(
              icon: const Icon(Icons.delete_forever, color: AppTheme.redButton),
              tooltip: 'Discard item',
              onPressed: () => _confirmDiscard(item),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildItemLeading(Map<String, dynamic> item) {
    if (item['image'] != null && (item['image'] as String).isNotEmpty) {
      return Image.asset(
        'assets/images/${item['image']}',
        width: 50,
        height: 50,
        fit: BoxFit.contain,
      );
    }
    // Sinon un simple icône
    return const Icon(Icons.collections, color: AppTheme.greenButton);
  }

  void _confirmDiscard(Map<String, dynamic> item) {
    final itemId = item['itemId'];
    final itemName = item['name'] ?? 'this item';

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppTheme.lightMint,
          title: Text(
            'Discard item?',
            style: AppTheme.themeData.textTheme.bodyLarge,
          ),
          content: Text(
            'Are you sure you want to discard $itemName?',
            style: AppTheme.themeData.textTheme.bodyMedium,
          ),
          actions: [
            TextButton(
              child: const Text('Cancel'),
              onPressed: () => Navigator.of(context).pop(),
            ),
            TextButton(
              child: const Text('Discard'),
              onPressed: () {
                Navigator.of(context).pop();
                widget.gameService.discardObject(
                  widget.gameId,
                  widget.playerId,
                  itemId,
                );
              },
            ),
          ],
        );
      },
    );
  }
}
